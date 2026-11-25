/**
 * Watched marks (issue #1). Stored only in this browser under couch_watched_v1,
 * and included in Export / Import.
 *
 * Compact model so long-running shows don't bloat storage:
 * - `allAiredAt`: set when the whole title is marked watched. For a show, every
 *   episode that had aired by that moment counts as watched; later episodes don't.
 *   For a movie, it's simply the watched timestamp.
 * - `episodes`: per-episode overrides by TVmaze episode id (true = watched,
 *   false = explicitly unwatched even though it aired before `allAiredAt`).
 */
import type { TmdbMediaType } from './tmdb';

export const WATCHED_KEY = 'couch_watched_v1';
export const HIDE_WATCHED_KEY = 'couch_hide_watched_v1';

export interface WatchedEntry {
  key: string;
  mediaType: TmdbMediaType;
  tmdbId: number | null;
  tvmazeId: number | null;
  title: string;
  year: string | null;
  posterPath: string | null;
  allAiredAt: string | null;
  episodes: Record<string, boolean>;
  updatedAt: string;
}

export type WatchedStore = Record<string, WatchedEntry>;

export interface WatchedRef {
  key: string;
  mediaType: TmdbMediaType;
  tmdbId: number | null;
  tvmazeId: number | null;
  title: string;
  year?: string | null;
  posterPath?: string | null;
}

export interface EpisodeRef {
  id: number;
  airstamp: string | null;
  airdate: string | null;
}

export function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Keep only well-formed entries; used on load and on Import. */
export function sanitizeWatched(raw: unknown): WatchedStore {
  if (!isPlainObject(raw)) return {};
  const out: WatchedStore = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!isPlainObject(v)) continue;
    if (v.mediaType !== 'movie' && v.mediaType !== 'tv') continue;
    if (typeof v.title !== 'string') continue;
    const episodes: Record<string, boolean> = {};
    if (isPlainObject(v.episodes)) {
      for (const [ek, ev] of Object.entries(v.episodes)) {
        if (/^\d{1,10}$/.test(ek) && typeof ev === 'boolean') episodes[ek] = ev;
      }
    }
    out[k] = {
      key: k,
      mediaType: v.mediaType,
      tmdbId: typeof v.tmdbId === 'number' ? v.tmdbId : null,
      tvmazeId: typeof v.tvmazeId === 'number' ? v.tvmazeId : null,
      title: v.title,
      year: typeof v.year === 'string' ? v.year : null,
      posterPath: typeof v.posterPath === 'string' ? v.posterPath : null,
      allAiredAt: typeof v.allAiredAt === 'string' ? v.allAiredAt : null,
      episodes,
      updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : new Date(0).toISOString(),
    };
  }
  return out;
}

export function loadWatched(): WatchedStore {
  try {
    const raw = localStorage.getItem(WATCHED_KEY);
    return raw ? sanitizeWatched(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function saveWatched(store: WatchedStore) {
  try {
    if (Object.keys(store).length === 0) localStorage.removeItem(WATCHED_KEY);
    else localStorage.setItem(WATCHED_KEY, JSON.stringify(store));
  } catch {
    // storage full or blocked
  }
}

export function loadHideWatched(): boolean {
  try {
    return localStorage.getItem(HIDE_WATCHED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveHideWatched(hide: boolean) {
  try {
    if (hide) localStorage.setItem(HIDE_WATCHED_KEY, 'true');
    else localStorage.removeItem(HIDE_WATCHED_KEY);
  } catch {
    // ignore
  }
}

/** Find the entry for a title: by key, then TVmaze id, then TMDB id, then normalized title (TV only). */
export function findWatched(
  store: WatchedStore,
  ref: { key?: string; mediaType?: TmdbMediaType; tmdbId?: number | null; tvmazeId?: number | null; title?: string }
): WatchedEntry | undefined {
  if (ref.key && store[ref.key]) return store[ref.key];
  const entries = Object.values(store);
  if (ref.tvmazeId != null) {
    const m = entries.find((e) => e.tvmazeId === ref.tvmazeId);
    if (m) return m;
  }
  if (ref.tmdbId != null && ref.mediaType) {
    const m = entries.find((e) => e.tmdbId === ref.tmdbId && e.mediaType === ref.mediaType);
    if (m) return m;
  }
  if (ref.title && ref.mediaType !== 'movie') {
    const n = normalizeTitle(ref.title);
    return entries.find((e) => e.mediaType === 'tv' && normalizeTitle(e.title) === n);
  }
  return undefined;
}

/** Title-level watched: marked as a whole and no aired episode was un-marked since. */
export function isTitleWatched(entry: WatchedEntry | undefined): boolean {
  if (!entry || !entry.allAiredAt) return false;
  return !Object.values(entry.episodes).some((v) => v === false);
}

function airedBy(ep: EpisodeRef, iso: string): boolean {
  const stamp = ep.airstamp ?? (ep.airdate ? `${ep.airdate}T23:59:59Z` : null);
  return stamp != null && stamp <= iso;
}

export function hasAired(ep: EpisodeRef, now = new Date().toISOString()): boolean {
  return airedBy(ep, now);
}

export function isEpisodeWatched(entry: WatchedEntry | undefined, ep: EpisodeRef): boolean {
  if (!entry) return false;
  const override = entry.episodes[String(ep.id)];
  if (override !== undefined) return override;
  return entry.allAiredAt != null && airedBy(ep, entry.allAiredAt);
}

function baseEntry(ref: WatchedRef, existing?: WatchedEntry): WatchedEntry {
  return {
    key: existing?.key ?? ref.key,
    mediaType: ref.mediaType,
    tmdbId: ref.tmdbId ?? existing?.tmdbId ?? null,
    tvmazeId: ref.tvmazeId ?? existing?.tvmazeId ?? null,
    title: ref.title || existing?.title || 'Untitled',
    year: ref.year ?? existing?.year ?? null,
    posterPath: ref.posterPath ?? existing?.posterPath ?? null,
    allAiredAt: existing?.allAiredAt ?? null,
    episodes: { ...(existing?.episodes ?? {}) },
    updatedAt: new Date().toISOString(),
  };
}

function withoutKey(store: WatchedStore, key: string): WatchedStore {
  const next = { ...store };
  delete next[key];
  return next;
}

/** Mark/unmark the whole title. Unmarking clears every episode mark for that title too. */
export function setTitleWatched(store: WatchedStore, ref: WatchedRef, watched: boolean): WatchedStore {
  const existing = findWatched(store, ref);
  if (!watched) return existing ? withoutKey(store, existing.key) : store;
  const entry = baseEntry(ref, existing);
  entry.allAiredAt = new Date().toISOString();
  // Explicit "unwatched" overrides are dropped; explicit "watched" ones stay (harmless).
  for (const [k, v] of Object.entries(entry.episodes)) if (v === false) delete entry.episodes[k];
  return { ...store, [entry.key]: entry };
}

/** Mark/unmark specific episodes only. Never changes the title-level mark for other episodes. */
export function setEpisodesWatched(store: WatchedStore, ref: WatchedRef, episodes: EpisodeRef[], watched: boolean): WatchedStore {
  const existing = findWatched(store, ref);
  const entry = baseEntry(ref, existing);
  for (const ep of episodes) {
    const k = String(ep.id);
    const implied = entry.allAiredAt != null && airedBy(ep, entry.allAiredAt);
    if (watched) {
      if (implied) delete entry.episodes[k];
      else entry.episodes[k] = true;
    } else if (implied) {
      entry.episodes[k] = false;
    } else {
      delete entry.episodes[k];
    }
  }
  const empty = !entry.allAiredAt && Object.keys(entry.episodes).length === 0;
  if (empty) return existing ? withoutKey(store, existing.key) : store;
  return { ...store, [entry.key]: entry };
}

/** Titles with any watched marks (whole show or single episodes), newest first: sources for Watch Next. */
export function watchedSources(store: WatchedStore): WatchedEntry[] {
  return Object.values(store)
    .filter((e) => e.allAiredAt != null || Object.values(e.episodes).some(Boolean))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
