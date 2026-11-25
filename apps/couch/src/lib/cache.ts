/** Small JSON cache in localStorage or sessionStorage, plus in-flight request deduping. */

export interface CacheEntry<T> {
  expires: number;
  value: T;
}

function readStore(kind: 'session' | 'local', name: string): Record<string, CacheEntry<unknown>> {
  try {
    const raw = (kind === 'session' ? sessionStorage : localStorage).getItem(name);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, CacheEntry<unknown>>) : {};
  } catch {
    return {};
  }
}

function writeStore(kind: 'session' | 'local', name: string, data: Record<string, CacheEntry<unknown>>) {
  try {
    const fresh: Record<string, CacheEntry<unknown>> = {};
    const now = Date.now();
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v.expires === 'number' && v.expires > now) fresh[k] = v;
    }
    (kind === 'session' ? sessionStorage : localStorage).setItem(name, JSON.stringify(fresh));
  } catch {
    // storage full or blocked
  }
}

export function cacheGet<T>(kind: 'session' | 'local', name: string, key: string): T | undefined {
  const entry = readStore(kind, name)[key];
  if (!entry || entry.expires <= Date.now()) return undefined;
  return entry.value as T;
}

export function cacheSet<T>(kind: 'session' | 'local', name: string, key: string, value: T, ttlMs: number) {
  const data = readStore(kind, name);
  data[key] = { expires: Date.now() + ttlMs, value };
  writeStore(kind, name, data);
}

const inflight = new Map<string, Promise<unknown>>();

/** If the same request is already in flight (this tab or overlapping views), reuse it. */
export function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const pending = fn().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, pending);
  return pending;
}
