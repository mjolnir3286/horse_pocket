import { DEFAULT_PROFILE, type Profile } from './energy.ts';
import { emptyNutrients, NUTRIENT_KEYS, type Nutrients } from './nutrition.ts';

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export const MEALS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snacks', label: 'Snacks' },
];

export interface FoodItem {
  id: string;
  name: string;
  servingSize: string;
  servingGrams: number | null;
  servingsPerContainer: number | null;
  /** Per one serving. */
  per: Nutrients;
  createdAt: string;
  lastUsedAt: string;
}

export interface LogEntry {
  id: string;
  /** Local day, YYYY-MM-DD. */
  date: string;
  meal: Meal;
  foodId: string | null;
  name: string;
  servings: number;
  amountText: string;
  /** Totals for the amount eaten. */
  nutrients: Nutrients;
  createdAt: string;
}

export interface PlanEntry {
  id: string;
  /** Local day, YYYY-MM-DD. */
  date: string;
  meal: Meal;
  foodId: string | null;
  name: string;
  servings: number;
  amountText: string;
  /** Copied totals for the planned amount so editing/deleting a saved food won't alter plans. */
  nutrients: Nutrients;
  createdAt: string;
}

export const STORAGE_KEYS = {
  profile: 'shed_profile_v1',
  foods: 'shed_foods_v1',
  log: 'shed_log_v1',
  plan: 'shed_plan_v1',
} as const;

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked; the app keeps working in memory
  }
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

export function cleanNutrients(v: unknown): Nutrients {
  const out = emptyNutrients();
  if (!v || typeof v !== 'object') return out;
  const o = v as Record<string, unknown>;
  for (const k of NUTRIENT_KEYS) out[k] = num(o[k]);
  return out;
}

export function cleanProfile(v: unknown): Profile {
  if (!v || typeof v !== 'object') return { ...DEFAULT_PROFILE };
  const o = v as Record<string, unknown>;
  const pick = <T extends string>(val: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(val as T) ? (val as T) : fallback;
  return {
    units: pick(o.units, ['imperial', 'metric'] as const, DEFAULT_PROFILE.units),
    sex: pick(o.sex, ['female', 'male'] as const, DEFAULT_PROFILE.sex),
    age: num(o.age),
    heightCm: num(o.heightCm),
    weightKg: num(o.weightKg),
    activity: pick(o.activity, ['sedentary', 'light', 'moderate', 'active', 'very'] as const, DEFAULT_PROFILE.activity),
    goal: pick(o.goal, ['maintain', 'lose', 'gain'] as const, DEFAULT_PROFILE.goal),
    pace: pick(o.pace, ['gentle', 'steady'] as const, DEFAULT_PROFILE.pace),
  };
}

export function cleanFood(v: unknown): FoodItem | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const name = str(o.name).trim();
  if (!name) return null;
  const now = new Date().toISOString();
  return {
    id: str(o.id) || newId(),
    name,
    servingSize: str(o.servingSize),
    servingGrams: num(o.servingGrams),
    servingsPerContainer: num(o.servingsPerContainer),
    per: cleanNutrients(o.per),
    createdAt: str(o.createdAt, now),
    lastUsedAt: str(o.lastUsedAt, now),
  };
}

const MEAL_KEYS = MEALS.map((m) => m.key);

function cleanMealEntry(v: unknown): LogEntry | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const date = str(o.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const name = str(o.name).trim();
  if (!name) return null;
  const rawServings = num(o.servings);
  return {
    id: str(o.id) || newId(),
    date,
    meal: MEAL_KEYS.includes(o.meal as Meal) ? (o.meal as Meal) : 'snacks',
    foodId: typeof o.foodId === 'string' ? o.foodId : null,
    name,
    servings: rawServings != null && rawServings > 0 ? rawServings : 1,
    amountText: str(o.amountText),
    nutrients: cleanNutrients(o.nutrients),
    createdAt: str(o.createdAt, new Date().toISOString()),
  };
}

export const cleanEntry = (v: unknown): LogEntry | null => cleanMealEntry(v);
export const cleanPlanEntry = (v: unknown): PlanEntry | null => cleanMealEntry(v);

const cleanList = <T,>(v: unknown, clean: (x: unknown) => T | null): T[] =>
  Array.isArray(v) ? v.map(clean).filter((x): x is T => x !== null) : [];

export const loadProfile = (): Profile => cleanProfile(read(STORAGE_KEYS.profile, null));
export const saveProfile = (p: Profile) => write(STORAGE_KEYS.profile, p);
export const loadFoods = (): FoodItem[] => cleanList(read(STORAGE_KEYS.foods, []), cleanFood);
export const saveFoods = (f: FoodItem[]) => write(STORAGE_KEYS.foods, f);
export const loadLog = (): LogEntry[] => cleanList(read(STORAGE_KEYS.log, []), cleanEntry);
export const saveLog = (l: LogEntry[]) => write(STORAGE_KEYS.log, l);
export const loadPlan = (): PlanEntry[] => cleanList(read(STORAGE_KEYS.plan, []), cleanPlanEntry);
export const savePlan = (p: PlanEntry[]) => write(STORAGE_KEYS.plan, p);

/** Build a log entry from a planned item without mutating the plan. */
export function logEntryFromPlan(item: PlanEntry, targetDate: string = item.date, now: Date = new Date()): LogEntry {
  return {
    id: newId(),
    date: targetDate,
    meal: item.meal,
    foodId: item.foodId,
    name: item.name,
    servings: item.servings,
    amountText: item.amountText,
    nutrients: { ...item.nutrients },
    createdAt: now.toISOString(),
  };
}

/** Meal that fits the current time, used as the default when adding food. */
export function mealForNow(date: Date = new Date()): Meal {
  const h = date.getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snacks';
}
