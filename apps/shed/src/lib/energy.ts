export type Sex = 'female' | 'male';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very';
export type Goal = 'maintain' | 'lose' | 'gain';
export type Pace = 'gentle' | 'steady';
export type Units = 'imperial' | 'metric';

export interface Profile {
  units: Units;
  sex: Sex;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activity: Activity;
  goal: Goal;
  pace: Pace;
}

export const ACTIVITY_LEVELS: { key: Activity; label: string; detail: string; factor: number }[] = [
  { key: 'sedentary', label: 'Sedentary', detail: 'Little or no exercise', factor: 1.2 },
  { key: 'light', label: 'Light', detail: 'Exercise 1–3 days a week', factor: 1.375 },
  { key: 'moderate', label: 'Moderate', detail: 'Exercise 3–5 days a week', factor: 1.55 },
  { key: 'active', label: 'Active', detail: 'Hard exercise 6–7 days a week', factor: 1.725 },
  { key: 'very', label: 'Very active', detail: 'Physical job or training twice a day', factor: 1.9 },
];

/** Daily adjustment in kcal for each goal and pace. */
export const GOAL_ADJUST: Record<Goal, Record<Pace, number>> = {
  maintain: { gentle: 0, steady: 0 },
  lose: { gentle: -250, steady: -500 },
  gain: { gentle: 250, steady: 500 },
};

/** Never suggest more than this share of TDEE as a deficit. */
export const MAX_DEFICIT_SHARE = 0.25;
/** Common floors below which an unsupervised target isn't suggested. */
export const MIN_TARGET: Record<Sex, number> = { female: 1200, male: 1500 };

export const DEFAULT_PROFILE: Profile = {
  units: 'imperial',
  sex: 'female',
  age: null,
  heightCm: null,
  weightKg: null,
  activity: 'light',
  goal: 'maintain',
  pace: 'gentle',
};

/** Mifflin-St Jeor resting energy, kcal/day. */
export function mifflinStJeor(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return base + (sex === 'male' ? 5 : -161);
}

export interface EnergyResult {
  bmr: number;
  tdee: number;
  target: number;
  /** Requested daily adjustment after limits (negative is a deficit). */
  adjustment: number;
  /** Set when a safety limit changed the target. */
  limitedBy: 'deficit-cap' | 'floor' | null;
}

export function profileComplete(p: Profile): boolean {
  return (
    p.age != null && p.age >= 13 && p.age <= 120 &&
    p.heightCm != null && p.heightCm >= 100 && p.heightCm <= 250 &&
    p.weightKg != null && p.weightKg >= 30 && p.weightKg <= 350
  );
}

export function computeEnergy(p: Profile): EnergyResult | null {
  if (!profileComplete(p)) return null;
  const bmr = mifflinStJeor(p.sex, p.weightKg!, p.heightCm!, p.age!);
  const factor = ACTIVITY_LEVELS.find((a) => a.key === p.activity)?.factor ?? 1.2;
  const tdee = bmr * factor;
  let adjustment = GOAL_ADJUST[p.goal][p.pace];
  let limitedBy: EnergyResult['limitedBy'] = null;

  if (adjustment < 0) {
    const cap = -Math.round(tdee * MAX_DEFICIT_SHARE);
    if (adjustment < cap) {
      adjustment = cap;
      limitedBy = 'deficit-cap';
    }
  }
  let target = tdee + adjustment;
  if (p.goal === 'lose') {
    const floor = MIN_TARGET[p.sex];
    if (target < floor) {
      // Stop at the floor; if maintenance is already below it, suggest maintenance.
      target = Math.min(tdee, floor);
      adjustment = target - tdee;
      limitedBy = 'floor';
    }
  }
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    target: Math.round(target / 10) * 10,
    adjustment: Math.round(adjustment),
    limitedBy,
  };
}

// ---- Unit helpers ----
export const cmToFtIn = (cm: number): { ft: number; inch: number } => {
  const totalIn = cm / 2.54;
  let ft = Math.floor(totalIn / 12);
  let inch = Math.round(totalIn - ft * 12);
  if (inch === 12) {
    ft += 1;
    inch = 0;
  }
  return { ft, inch };
};
export const ftInToCm = (ft: number, inch: number): number => (ft * 12 + inch) * 2.54;
export const kgToLb = (kg: number): number => kg * 2.2046226218;
export const lbToKg = (lb: number): number => lb / 2.2046226218;
