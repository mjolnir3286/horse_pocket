import type { Profile } from './energy';
import { cleanEntry, cleanFood, cleanProfile, type FoodItem, type LogEntry } from './storage';

export interface ShedBackupV1 {
  app: 'shed';
  version: 1;
  exportedAt: string;
  profile: Profile;
  foods: FoodItem[];
  log: LogEntry[];
}

export function buildBackup(profile: Profile, foods: FoodItem[], log: LogEntry[]): ShedBackupV1 {
  return { app: 'shed', version: 1, exportedAt: new Date().toISOString(), profile, foods, log };
}

export type ImportResult =
  | { ok: true; backup: ShedBackupV1; summary: string }
  | { ok: false; error: string };

export function parseBackup(rawText: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    return { ok: false, error: 'That file isn’t valid JSON. Choose a Shed backup (.json).' };
  }
  if (!data || typeof data !== 'object') return { ok: false, error: 'That file isn’t a Shed backup.' };
  const o = data as Record<string, unknown>;
  if (o.app !== 'shed') return { ok: false, error: 'That backup is from a different app, not Shed.' };
  if (o.version !== 1) return { ok: false, error: `This backup is version ${String(o.version)}, which this Shed can’t read.` };
  const foods = Array.isArray(o.foods) ? o.foods.map(cleanFood).filter((x): x is FoodItem => x !== null) : [];
  const log = Array.isArray(o.log) ? o.log.map(cleanEntry).filter((x): x is LogEntry => x !== null) : [];
  const backup: ShedBackupV1 = {
    app: 'shed',
    version: 1,
    exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : '',
    profile: cleanProfile(o.profile),
    foods,
    log,
  };
  const days = new Set(log.map((e) => e.date)).size;
  const when = backup.exportedAt ? ` from ${new Date(backup.exportedAt).toLocaleDateString()}` : '';
  const summary = `Backup${when}: ${log.length} log ${log.length === 1 ? 'entry' : 'entries'} over ${days} ${days === 1 ? 'day' : 'days'}, ${foods.length} saved ${foods.length === 1 ? 'food' : 'foods'}, and your profile. This replaces what’s on this device.`;
  return { ok: true, backup, summary };
}

export function backupFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `shed-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

export function downloadJsonFile(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
