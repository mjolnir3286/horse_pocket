import { emptyNutrients, type Nutrients, type NutrientKey } from './nutrition.ts';

export interface ParsedLabel {
  servingSize: string | null;
  servingGrams: number | null;
  servingsPerContainer: number | null;
  nutrients: Nutrients;
  /** Fields the parser had to guess at, worth a second look. */
  uncertain: NutrientKey[];
  /** How many of the main fields were found (for a quick "looks good / try again" hint). */
  found: number;
}

/** FDA Daily Values (2016 rule), used to cross-check numbers OCR may have garbled. */
const DAILY_VALUE: Partial<Record<NutrientKey, number>> = {
  fat: 78,
  satFat: 20,
  cholesterol: 300,
  sodium: 2300,
  carbs: 275,
  fiber: 28,
  protein: 50,
};

/** Upper bounds per serving that real labels rarely exceed. */
const PLAUSIBLE_MAX: Record<NutrientKey, number> = {
  calories: 2000,
  fat: 100,
  satFat: 50,
  cholesterol: 1000,
  sodium: 5000,
  carbs: 200,
  fiber: 60,
  sugar: 100,
  protein: 120,
};

type Unit = 'g' | 'mg';

interface FieldRule {
  key: Exclude<NutrientKey, 'calories'>;
  unit: Unit;
  match: RegExp;
  skip?: RegExp;
}

const FIELD_RULES: FieldRule[] = [
  { key: 'satFat', unit: 'g', match: /\bsat(?:urated|\.)?\s*fat\b/i },
  { key: 'fat', unit: 'g', match: /\btota[l1i]?\s*fat\b/i, skip: /\b(sat|trans)/i },
  { key: 'cholesterol', unit: 'mg', match: /\bcho[l1i]est[a-z]*/i },
  { key: 'sodium', unit: 'mg', match: /\bsod[il1]um\b/i },
  { key: 'carbs', unit: 'g', match: /\b(?:tota[l1i]?\s*)?carb[a-z]*/i },
  { key: 'fiber', unit: 'g', match: /\b(?:dietary\s*)?fib(?:er|re)\b/i },
  { key: 'sugar', unit: 'g', match: /\b(?:tota[l1i]?\s*)?sugars?\b/i, skip: /\b(added|incl|alcohol)/i },
  { key: 'protein', unit: 'g', match: /\bprote[il1]n\b/i },
];

/** Fix common OCR letter/digit swaps inside number-ish tokens. */
function normalizeLine(line: string): string {
  return (
    line
      .replace(/[|]/g, ' ')
      // O/o between or next to digits -> 0, l/I next to digits -> 1
      .replace(/(?<=\d)[Oo]|[Oo](?=\d)/g, '0')
      .replace(/(?<=\d)[lI]|[lI](?=\d)/g, '1')
      .replace(/\b[Oo](?=\s?m?g\b)/g, '0')
      .replace(/(\d),(\d)/g, '$1.$2')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

interface Reading {
  value: number;
  uncertain: boolean;
  /** The value with a trailing "9" dropped, when that might have been a misread "g". */
  alt?: number;
}

function closer(a: number, b: number, target: number): number {
  return Math.abs(a - target) <= Math.abs(b - target) ? a : b;
}

/**
 * Pull the amount after a field name. Handles "8g", "8 g", "<1g", "160mg",
 * and the very common OCR misread of a trailing "g" as "9" ("89" for "8g").
 */
function readAmount(rest: string, key: NutrientKey, unit: Unit): Reading | null {
  const m = /(<|less than)?\s*(\d+(?:\.\d+)?)\s*(mg|m9|mq|rng|g|9|q)?(?![\d%])/i.exec(rest);
  if (!m) return null;
  const lessThan = Boolean(m[1]);
  const raw = m[2];
  const rawUnit = (m[3] ?? '').toLowerCase();
  let value = Number(raw);
  if (!Number.isFinite(value)) return null;

  if (lessThan) return { value: value <= 1 ? 0.5 : value, uncertain: false };

  const pctMatch = /(\d{1,3})\s*%/.exec(rest.slice(m.index + m[0].length));
  const dv = DAILY_VALUE[key];
  const expected = pctMatch && dv ? (Number(pctMatch[1]) * dv) / 100 : null;

  let uncertain = false;
  let alt: number | undefined;
  const unitIsGLike = rawUnit === 'g' || rawUnit === 'q';
  // A real unit after the number: trust it, except an "mg" field reading "9" as its unit.
  if (unit === 'g' && (rawUnit === '9' || rawUnit === '')) {
    // "8 9" (unit split off) or "89" (unit glued on) are both likely "8g".
    if (rawUnit === '9') {
      // number then a separate "9" -> unit misread; value is fine
    } else if (/\.\d9$/.test(raw)) {
      // Labels show at most one decimal, so "3.59" is "3.5g".
      value = Number(raw.slice(0, -1));
    } else if (raw.length >= 2 && raw.endsWith('9') && !raw.includes('.')) {
      const stripped = Number(raw.slice(0, -1));
      if (expected != null) {
        value = closer(stripped, value, expected);
      } else if (value > PLAUSIBLE_MAX[key]) {
        value = stripped;
      } else {
        uncertain = true;
        alt = stripped;
      }
    }
  } else if (unit === 'mg' && rawUnit === '' && raw.length >= 2 && raw.endsWith('9')) {
    // "160m9" is handled by the unit regex; a lone trailing 9 might be "mg" lost entirely.
    const stripped = Number(raw.slice(0, -1));
    if (expected != null) value = closer(stripped, value, expected);
    else uncertain = true;
  } else if (unitIsGLike && unit === 'mg') {
    // e.g. "Sodium 160g" is not realistic; keep value, flag it.
    uncertain = true;
  }

  if (expected != null && Math.abs(value - expected) > Math.max(3, expected * 0.6)) uncertain = true;
  if (value > PLAUSIBLE_MAX[key]) uncertain = true;
  return { value, uncertain, alt };
}

export function parseNutritionLabel(text: string): ParsedLabel {
  const lines = text
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter((l) => l.length > 0);

  const nutrients = emptyNutrients();
  const uncertain: NutrientKey[] = [];
  const alts: Partial<Record<NutrientKey, number>> = {};
  let servingSize: string | null = null;
  let servingGrams: number | null = null;
  let servingsPerContainer: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Old-label footer ("Calories per gram: Fat 9 • Carbohydrate 4 • Protein 4") is not data.
    if (/per\s*gram/i.test(line)) continue;

    // Servings per container: "8 servings per container", "Servings Per Container About 8"
    if (servingsPerContainer == null) {
      const a = /(?:about\s*)?(\d+(?:\.\d+)?)\s*servings?\s*per\s*(?:container|package|pkg)/i.exec(line);
      const b = /servings?\s*per\s*(?:container|package|pkg)\s*:?\s*(?:about\s*)?(\d+(?:\.\d+)?)/i.exec(line);
      const hit = a ?? b;
      if (hit) servingsPerContainer = Number(hit[1]);
    }

    // Serving size: "Serving size 2/3 cup (55g)"
    if (servingSize == null) {
      const s = /serving\s*size\s*:?\s*(.+)$/i.exec(line);
      if (s) {
        let size = s[1].trim();
        // sometimes the amount lands on the next line
        if (!/\d/.test(size) && lines[i + 1]) size = `${size} ${lines[i + 1]}`.trim();
        servingSize = size.replace(/\s+/g, ' ');
        const g = /\(?\s*(\d+(?:\.\d+)?)\s*(g|9|grams?)\s*\)/i.exec(servingSize);
        const glued = /\((\d{2,4})\)/.exec(servingSize);
        if (g) servingGrams = Number(g[1]);
        else if (glued && glued[1].endsWith('9')) servingGrams = Number(glued[1].slice(0, -1));
        else {
          const plain = /(\d+(?:\.\d+)?)\s*g\b/i.exec(servingSize);
          if (plain) servingGrams = Number(plain[1]);
        }
        servingSize = servingSize.replace(/\s*\(\s*\d+(?:\.\d+)?\s*(?:g|9|grams?)?\s*\)\s*/i, ' ').trim() || servingSize;
      }
    }

    // Calories: "Calories 230", or "Calories" with the number on the next line.
    if (nutrients.calories == null && /\bca[l1i]or[il1]es\b/i.test(line) && !/^\W*ca[l1i]or[il1]es\s*from\s*fat/i.test(line)) {
      const after = line.replace(/^.*?\bca[l1i]or[il1]es\b/i, '');
      const m = /(\d{1,4})/.exec(after);
      if (m) nutrients.calories = Number(m[1]);
      else if (lines[i + 1]) {
        const next = /^(\d{1,4})\b/.exec(lines[i + 1]);
        if (next) nutrients.calories = Number(next[1]);
      }
      if (nutrients.calories != null && nutrients.calories > PLAUSIBLE_MAX.calories) uncertain.push('calories');
    }

    for (const rule of FIELD_RULES) {
      if (nutrients[rule.key] != null) continue;
      const hit = rule.match.exec(line);
      if (!hit) continue;
      if (rule.skip && rule.skip.test(line.slice(0, hit.index + hit[0].length + 6))) continue;
      // "Total Fat" must not also match "Saturated Fat" lines, etc.
      if (rule.key === 'fat' && /\bsat/i.test(line)) continue;
      const rest = line.slice(hit.index + hit[0].length);
      const reading = readAmount(rest, rule.key, rule.unit);
      if (!reading) continue;
      nutrients[rule.key] = reading.value;
      if (reading.uncertain) uncertain.push(rule.key);
      if (reading.alt != null) alts[rule.key] = reading.alt;
    }
  }

  // A part can't exceed its whole: sugar and fiber are within carbs, sat fat within fat.
  const parts: [NutrientKey, NutrientKey][] = [
    ['sugar', 'carbs'],
    ['fiber', 'carbs'],
    ['satFat', 'fat'],
  ];
  for (const [part, whole] of parts) {
    const pv = nutrients[part];
    const wv = nutrients[whole];
    const alt = alts[part];
    if (pv != null && wv != null && pv > wv && alt != null && alt <= wv) {
      nutrients[part] = alt;
      const idx = uncertain.indexOf(part);
      if (idx >= 0) uncertain.splice(idx, 1);
    }
  }

  const mainKeys: NutrientKey[] = ['calories', 'fat', 'carbs', 'protein'];
  const found =
    mainKeys.filter((k) => nutrients[k] != null).length +
    (servingSize ? 1 : 0);

  return { servingSize, servingGrams, servingsPerContainer, nutrients, uncertain, found };
}
