import type { TmdbMediaType } from '../services/tmdb';

export const WATCHLIST_VIEW_STORAGE_KEY = 'couch_watchlist_view_v1';

export type WatchlistSortKey = 'recent' | 'title-az' | 'release-newest' | 'release-oldest' | 'upcoming';
export type WatchlistTypeFilter = 'all' | TmdbMediaType;

export interface WatchlistViewState {
  sort: WatchlistSortKey;
  typeFilter: WatchlistTypeFilter;
}

export interface SortOption<K extends string = WatchlistSortKey> {
  value: K;
  label: string;
  shortLabel: string;
}

export interface FilterChipOption<V extends string = WatchlistTypeFilter> {
  value: V;
  label: string;
}

export const WATCHLIST_SORT_OPTIONS: ReadonlyArray<SortOption<WatchlistSortKey>> = [
  { value: 'recent', label: 'Recently added', shortLabel: 'Recent' },
  { value: 'title-az', label: 'Title A–Z', shortLabel: 'Title A–Z' },
  { value: 'release-newest', label: 'Newest to oldest', shortLabel: 'Newest' },
  { value: 'release-oldest', label: 'Oldest to newest', shortLabel: 'Oldest' },
  { value: 'upcoming', label: 'Upcoming', shortLabel: 'Upcoming' },
];

export const WATCHLIST_TYPE_FILTERS: ReadonlyArray<FilterChipOption<WatchlistTypeFilter>> = [
  { value: 'all', label: 'All' },
  { value: 'tv', label: 'Shows' },
  { value: 'movie', label: 'Movies' },
];

export const DEFAULT_WATCHLIST_VIEW: WatchlistViewState = {
  sort: 'recent',
  typeFilter: 'all',
};

export interface WatchlistSortableItem {
  key: string;
  mediaType: TmdbMediaType;
  title: string;
  year: string | null;
  releaseDate?: string | null;
  followedAt?: string | null;
  lastStatus?: {
    next: { airdate: string | null } | null;
  };
}

export function isWatchlistSortKey(value: unknown): value is WatchlistSortKey {
  return WATCHLIST_SORT_OPTIONS.some((option) => option.value === value);
}

/** Accept a known Watchlist sort key, otherwise fall back to Recently added. */
export function parseWatchlistSortKey(value: unknown): WatchlistSortKey {
  return isWatchlistSortKey(value) ? value : 'recent';
}

export function isWatchlistTypeFilter(value: unknown): value is WatchlistTypeFilter {
  return WATCHLIST_TYPE_FILTERS.some((option) => option.value === value);
}

export function sanitizeWatchlistView(value: unknown): WatchlistViewState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ...DEFAULT_WATCHLIST_VIEW };
  }
  const raw = value as Record<string, unknown>;
  return {
    sort: isWatchlistSortKey(raw.sort) ? raw.sort : DEFAULT_WATCHLIST_VIEW.sort,
    typeFilter: isWatchlistTypeFilter(raw.typeFilter) ? raw.typeFilter : DEFAULT_WATCHLIST_VIEW.typeFilter,
  };
}

export function readWatchlistView(storage?: Pick<Storage, 'getItem'>): WatchlistViewState {
  try {
    const store = storage ?? globalThis.localStorage;
    const raw = store.getItem(WATCHLIST_VIEW_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WATCHLIST_VIEW };
    return sanitizeWatchlistView(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_WATCHLIST_VIEW };
  }
}

export function writeWatchlistView(state: WatchlistViewState, storage?: Pick<Storage, 'setItem'>): void {
  try {
    const store = storage ?? globalThis.localStorage;
    store.setItem(WATCHLIST_VIEW_STORAGE_KEY, JSON.stringify(sanitizeWatchlistView(state)));
  } catch {
    // ignore quota / private-mode failures
  }
}

function localDateIso(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function compareTitles(a: WatchlistSortableItem, b: WatchlistSortableItem): number {
  return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || a.title.localeCompare(b.title);
}

function parseTimestampMs(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_RE = /^\d{4}$/;

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_RE.test(value);
}

function releaseSortKey(item: WatchlistSortableItem): string | null {
  if (isIsoDate(item.releaseDate)) return item.releaseDate;
  if (typeof item.year === 'string') {
    const year = item.year.trim();
    if (YEAR_RE.test(year)) return year;
  }
  return null;
}

function upcomingAirdate(item: WatchlistSortableItem, todayIso: string): string | null {
  if (item.mediaType !== 'tv') return null;
  const airdate = item.lastStatus?.next?.airdate;
  return isIsoDate(airdate) && airdate >= todayIso ? airdate : null;
}

export function compareWatchlistItems(
  a: WatchlistSortableItem,
  b: WatchlistSortableItem,
  sort: WatchlistSortKey,
  todayIso = localDateIso()
): number {
  if (sort === 'title-az') {
    return compareTitles(a, b);
  }

  if (sort === 'recent') {
    const aMs = parseTimestampMs(a.followedAt);
    const bMs = parseTimestampMs(b.followedAt);
    if (aMs !== null && bMs !== null) {
      return aMs !== bMs ? bMs - aMs : compareTitles(a, b);
    }
    if (aMs !== null) return -1;
    if (bMs !== null) return 1;
    return compareTitles(a, b);
  }

  if (sort === 'release-newest' || sort === 'release-oldest') {
    const aDate = releaseSortKey(a);
    const bDate = releaseSortKey(b);
    if (aDate === null && bDate === null) return compareTitles(a, b);
    if (aDate === null) return 1;
    if (bDate === null) return -1;
    const cmp = aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
    if (cmp !== 0) return sort === 'release-newest' ? -cmp : cmp;
    return compareTitles(a, b);
  }

  if (sort === 'upcoming') {
    const aNext = upcomingAirdate(a, todayIso);
    const bNext = upcomingAirdate(b, todayIso);
    if (aNext === null && bNext === null) return compareTitles(a, b);
    if (aNext === null) return 1;
    if (bNext === null) return -1;
    const cmp = aNext < bNext ? -1 : aNext > bNext ? 1 : 0;
    return cmp !== 0 ? cmp : compareTitles(a, b);
  }

  // Unknown sort keys fall back to Recently added.
  return compareWatchlistItems(a, b, 'recent', todayIso);
}

export function sortWatchlist<T extends WatchlistSortableItem>(
  items: readonly T[],
  sort: WatchlistSortKey,
  now = new Date()
): T[] {
  const todayIso = localDateIso(now);
  return [...items].sort((a, b) => compareWatchlistItems(a, b, sort, todayIso));
}

export function applyWatchlistView<T extends WatchlistSortableItem>(
  items: readonly T[],
  view: WatchlistViewState,
  isHidden?: (item: T) => boolean,
  now = new Date()
): { typeFilteredCount: number; items: T[] } {
  const typeFiltered = view.typeFilter === 'all' ? [...items] : items.filter((item) => item.mediaType === view.typeFilter);
  const visible = isHidden ? typeFiltered.filter((item) => !isHidden(item)) : typeFiltered;
  return {
    typeFilteredCount: typeFiltered.length,
    items: sortWatchlist(visible, view.sort, now),
  };
}
