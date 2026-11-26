import { sumNutrients, type Nutrients } from './nutrition.ts';
import type { LogEntry, PlanEntry } from './storage.ts';

export interface DaySummary {
  kcal: number;
  count: number;
  nutrients: Nutrients;
}

function summarizeByDate(items: { date: string; nutrients: Nutrients }[]): Map<string, DaySummary> {
  const grouped = new Map<string, Nutrients[]>();
  for (const item of items) {
    const list = grouped.get(item.date);
    if (list) list.push(item.nutrients);
    else grouped.set(item.date, [item.nutrients]);
  }
  const out = new Map<string, DaySummary>();
  for (const [date, list] of grouped) {
    const nutrients = sumNutrients(list);
    out.set(date, {
      kcal: nutrients.calories ?? 0,
      count: list.length,
      nutrients,
    });
  }
  return out;
}

export function summarizeLogByDate(log: LogEntry[]): Map<string, DaySummary> {
  return summarizeByDate(log);
}

export function summarizePlanByDate(plan: PlanEntry[]): Map<string, DaySummary> {
  return summarizeByDate(plan);
}

/** Count log entries older than the 60-day calendar display window (never deleted). */
export function countOlderLogEntries(log: LogEntry[], minDay: string): number {
  let count = 0;
  for (const e of log) {
    if (e.date < minDay) count += 1;
  }
  return count;
}
