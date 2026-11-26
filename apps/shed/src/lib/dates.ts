export const HISTORY_DAYS = 60;
export const PLAN_WEEKS_AHEAD = 4;

/** Local calendar day as YYYY-MM-DD (not UTC, so late-night meals land on the right day). */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function shiftDay(key: string, delta: number): string {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
}

/** Sunday-based start of the week containing `key`. */
export function startOfWeek(key: string): string {
  const d = parseDayKey(key);
  return shiftDay(key, -d.getDay());
}

/** Seven YYYY-MM-DD keys from `weekStart` (Sun..Sat). */
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftDay(weekStart, i));
}

export interface PlanBounds {
  minDay: string;
  maxDay: string;
  minWeekStart: string;
  currentWeekStart: string;
  maxWeekStart: string;
}

/** Calendar navigation bounds: last 60 days through current week + 4 weeks ahead. */
export function planBounds(today: string = dayKey()): PlanBounds {
  const minDay = shiftDay(today, -HISTORY_DAYS);
  const currentWeekStart = startOfWeek(today);
  const maxWeekStart = shiftDay(currentWeekStart, PLAN_WEEKS_AHEAD * 7);
  return {
    minDay,
    maxDay: shiftDay(maxWeekStart, 6),
    minWeekStart: startOfWeek(minDay),
    currentWeekStart,
    maxWeekStart,
  };
}

export function formatDay(key: string, today: string = dayKey()): string {
  if (key === today) return 'Today';
  if (key === shiftDay(today, -1)) return 'Yesterday';
  if (key === shiftDay(today, 1)) return 'Tomorrow';
  const d = parseDayKey(key);
  const sameYear = d.getFullYear() === parseDayKey(today).getFullYear();
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function formatLongDay(key: string, today: string = dayKey()): string {
  const d = parseDayKey(key);
  const sameYear = d.getFullYear() === parseDayKey(today).getFullYear();
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function formatWeekRange(weekStart: string, today: string = dayKey()): string {
  const s = parseDayKey(weekStart);
  const e = parseDayKey(shiftDay(weekStart, 6));
  const todayYear = parseDayKey(today).getFullYear();
  const sameMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
  const showYear = s.getFullYear() !== todayYear || e.getFullYear() !== todayYear;
  const startText = s.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(showYear && s.getFullYear() !== e.getFullYear() ? { year: 'numeric' } : {}),
  });
  const endText = sameMonth
    ? e.toLocaleDateString(undefined, {
        day: 'numeric',
        ...(showYear ? { year: 'numeric' } : {}),
      })
    : e.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        ...(showYear ? { year: 'numeric' } : {}),
      });
  return `${startText} – ${endText}`;
}

export function shortWeekday(key: string): string {
  return parseDayKey(key).toLocaleDateString(undefined, { weekday: 'short' });
}

export function dayOfMonth(key: string): number {
  return parseDayKey(key).getDate();
}
