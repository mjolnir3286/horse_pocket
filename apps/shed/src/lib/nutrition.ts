/** Nutrient amounts for one serving (or a computed total). `null` means unknown. */
export interface Nutrients {
  calories: number | null;
  fat: number | null; // g
  satFat: number | null; // g
  cholesterol: number | null; // mg
  sodium: number | null; // mg
  carbs: number | null; // g
  fiber: number | null; // g
  sugar: number | null; // g
  protein: number | null; // g
}

export type NutrientKey = keyof Nutrients;

export const NUTRIENT_FIELDS: { key: NutrientKey; label: string; unit: 'kcal' | 'g' | 'mg' }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'fat', label: 'Total fat', unit: 'g' },
  { key: 'satFat', label: 'Saturated fat', unit: 'g' },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
  { key: 'carbs', label: 'Total carbs', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sugar', label: 'Total sugars', unit: 'g' },
  { key: 'protein', label: 'Protein', unit: 'g' },
];

export const NUTRIENT_KEYS: NutrientKey[] = NUTRIENT_FIELDS.map((f) => f.key);

export function emptyNutrients(): Nutrients {
  return {
    calories: null,
    fat: null,
    satFat: null,
    cholesterol: null,
    sodium: null,
    carbs: null,
    fiber: null,
    sugar: null,
    protein: null,
  };
}

export function roundFor(key: NutrientKey, value: number): number {
  if (key === 'calories' || key === 'sodium' || key === 'cholesterol') return Math.round(value);
  return Math.round(value * 10) / 10;
}

/** Multiply every known nutrient by `factor`, rounding to label-style precision. */
export function scaleNutrients(per: Nutrients, factor: number): Nutrients {
  const out = emptyNutrients();
  for (const key of NUTRIENT_KEYS) {
    const v = per[key];
    out[key] = v == null || !Number.isFinite(factor) ? null : roundFor(key, v * factor);
  }
  return out;
}

/** Sum nutrients; unknown values count as 0 so totals stay usable. */
export function sumNutrients(list: Nutrients[]): Nutrients {
  const out = emptyNutrients();
  for (const key of NUTRIENT_KEYS) {
    let total = 0;
    let any = false;
    for (const n of list) {
      const v = n[key];
      if (v != null) {
        total += v;
        any = true;
      }
    }
    out[key] = any ? roundFor(key, total) : null;
  }
  return out;
}

export type AmountMode = 'servings' | 'grams';

/**
 * How many servings an amount represents.
 * Grams need the serving weight from the label; returns null when it's missing.
 */
export function servingsFromAmount(
  amount: number,
  mode: AmountMode,
  servingGrams: number | null
): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (mode === 'servings') return amount;
  if (!servingGrams || servingGrams <= 0) return null;
  return amount / servingGrams;
}

export function formatAmount(amount: number, mode: AmountMode): string {
  const n = Math.round(amount * 100) / 100;
  if (mode === 'grams') return `${n} g`;
  return `${n} ${n === 1 ? 'serving' : 'servings'}`;
}
