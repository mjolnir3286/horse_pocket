import {
  saveAlerts,
  saveFollows,
  type FollowedTitle,
} from './follows';
import type { NewEpisodeAlert, PlatformId } from '../types/streaming';
import { HIDE_WATCHED_KEY, sanitizeWatched } from './watched';

export type StatusFilter = 'all' | 'confirmed' | 'unconfirmed' | 'followed';
export type SortKey = 'date-soonest' | 'date-latest' | 'provider-az' | 'title-az' | 'confidence';
export type PlatformFilterId = PlatformId | 'unknown' | 'none';
export type DiscoverTypeFilter = 'all' | 'movie' | 'tv';

export const STATUS_STORAGE_KEY = 'horse_pocket_upcoming_status_v1';
export const WATCHLIST_ONLY_STORAGE_KEY = 'couch_watchlist_only_v1';
export const PLATFORM_STORAGE_KEY = 'horse_pocket_upcoming_platforms_v1';
export const SORT_STORAGE_KEY = 'horse_pocket_upcoming_sort_v1';
export const WELCOME_DISMISSED_KEY = 'horse_pocket_welcome_dismissed_v1';
export const FOLLOWED_LEADS_STORAGE_KEY = 'horse_pocket_followed_leads_v1';
const LAST_CHECK_KEY = 'couch_last_episode_check_v1';

/**
 * Storage key reserved for watched marks (issue #1).
 * Export/Import preserves whatever object is stored here so watched marks
 * round-trip cleanly once issue #1 lands.
 */
export const WATCHED_STORAGE_KEY = 'couch_watched_v1';

export const SORT_OPTIONS: Array<{ value: SortKey; label: string; shortLabel: string }> = [
  { value: 'date-soonest', label: 'Date: soonest first', shortLabel: 'Soonest' },
  { value: 'date-latest', label: 'Date: latest first', shortLabel: 'Latest' },
  { value: 'provider-az', label: 'Platform A–Z', shortLabel: 'Platform' },
  { value: 'title-az', label: 'Title A–Z', shortLabel: 'Title' },
  { value: 'confidence', label: 'Confidence', shortLabel: 'Confidence' },
];

export const isStatusFilter = (value: unknown): value is StatusFilter =>
  value === 'all' || value === 'confirmed' || value === 'unconfirmed' || value === 'followed';

export const isSortKey = (value: unknown): value is SortKey =>
  SORT_OPTIONS.some((option) => option.value === value);

export const isPlatformFilterList = (value: unknown): value is PlatformFilterId[] =>
  Array.isArray(value) &&
  value.every(
    (id) =>
      id === 'none' ||
      id === 'unknown' ||
      id === 'netflix' ||
      id === 'disney-plus' ||
      id === 'hulu' ||
      id === 'prime-video' ||
      id === 'max' ||
      id === 'apple-tv-plus' ||
      id === 'peacock' ||
      id === 'paramount-plus'
  );

const isDiscoverTypeFilter = (value: unknown): value is DiscoverTypeFilter =>
  value === 'all' || value === 'movie' || value === 'tv';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readStorage<T>(key: string, fallback: T, validate: (value: unknown) => value is T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    return validate(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / private-mode failures
  }
}

/** Read the Watchlist-only toggle, migrating a saved All/Confirmed/Unconfirmed/Watchlisted chip. */
export function readWatchlistOnly(): boolean {
  const stored = readStorage(WATCHLIST_ONLY_STORAGE_KEY, null as boolean | null, (value): value is boolean => value === true || value === false);
  if (stored !== null) return stored;
  const legacy = readStorage(STATUS_STORAGE_KEY, 'all' as StatusFilter, isStatusFilter);
  const migrated = legacy === 'followed';
  writeWatchlistOnly(migrated);
  return migrated;
}

export function writeWatchlistOnly(value: boolean) {
  writeStorage(WATCHLIST_ONLY_STORAGE_KEY, value);
  // Keep the old key in a compatible shape so backups and older exports still make sense.
  writeStorage(STATUS_STORAGE_KEY, value ? 'followed' : 'all');
}

export function readWatchedForBackup(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(WATCHED_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function writeWatchedFromBackup(watched: Record<string, unknown>) {
  try {
    if (Object.keys(watched).length === 0) {
      localStorage.removeItem(WATCHED_STORAGE_KEY);
    } else {
      localStorage.setItem(WATCHED_STORAGE_KEY, JSON.stringify(watched));
    }
  } catch {
    // ignore
  }
}

export interface CouchBackup {
  app: 'couch';
  version: 1;
  exportedAt: string;
  watchlist: {
    follows: FollowedTitle[];
    followedLeadNames: string[];
    alerts: NewEpisodeAlert[];
    lastCheckedAt: string | null;
  };
  watched: Record<string, unknown>;
  settings: {
    welcomeDismissed: boolean;
    discoverTypeFilter: DiscoverTypeFilter;
    hideWatched: boolean;
  };
  filters: {
    watchlistOnly: boolean;
    upcomingStatus: StatusFilter;
    upcomingPlatforms: PlatformFilterId[];
    upcomingSort: SortKey;
  };
}

export interface CouchExportInput {
  follows: FollowedTitle[];
  followedLeadNames: string[];
  alerts: NewEpisodeAlert[];
  lastCheckedAt: string | null;
  welcomeDismissed: boolean;
  discoverTypeFilter: DiscoverTypeFilter;
  hideWatched: boolean;
}

export function buildCouchBackup(input: CouchExportInput): CouchBackup {
  return {
    app: 'couch',
    version: 1,
    exportedAt: new Date().toISOString(),
    watchlist: {
      follows: input.follows,
      followedLeadNames: input.followedLeadNames,
      alerts: input.alerts,
      lastCheckedAt: input.lastCheckedAt,
    },
    watched: readWatchedForBackup(),
    settings: {
      welcomeDismissed: input.welcomeDismissed,
      discoverTypeFilter: input.discoverTypeFilter,
      hideWatched: input.hideWatched,
    },
    filters: {
      watchlistOnly: readWatchlistOnly(),
      upcomingStatus: readWatchlistOnly() ? 'followed' : 'all',
      upcomingPlatforms: readStorage(PLATFORM_STORAGE_KEY, [] as PlatformFilterId[], isPlatformFilterList),
      upcomingSort: readStorage(SORT_STORAGE_KEY, 'date-soonest' as SortKey, isSortKey),
    },
  };
}

function isValidFollow(item: unknown): item is FollowedTitle {
  if (!isPlainObject(item)) return false;
  return (
    typeof item.key === 'string' &&
    item.key.length > 0 &&
    (item.mediaType === 'movie' || item.mediaType === 'tv') &&
    typeof item.title === 'string' &&
    typeof item.followedAt === 'string' &&
    (item.tmdbId === null || typeof item.tmdbId === 'number') &&
    (item.tvmazeId === null || typeof item.tvmazeId === 'number')
  );
}

function isValidAlert(item: unknown): item is NewEpisodeAlert {
  if (!isPlainObject(item)) return false;
  return (
    typeof item.id === 'string' &&
    typeof item.followKey === 'string' &&
    typeof item.showTitle === 'string' &&
    typeof item.season === 'number' &&
    typeof item.episode === 'number'
  );
}

export function parseCouchBackup(
  rawText: string
): { ok: true; backup: CouchBackup } | { ok: false; error: string } {
  const friendly = 'Could not import file. Make sure it is a valid Couch backup (.json).';
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: friendly };
  }

  if (!isPlainObject(parsed) || parsed.app !== 'couch' || parsed.version !== 1) {
    return { ok: false, error: friendly };
  }

  const wl = parsed.watchlist;
  const settings = parsed.settings;
  const filters = parsed.filters;
  if (!isPlainObject(wl) || !isPlainObject(settings) || !isPlainObject(filters)) {
    return { ok: false, error: friendly };
  }

  if (!Array.isArray(wl.follows) || !wl.follows.every(isValidFollow)) {
    return { ok: false, error: friendly };
  }
  if (!Array.isArray(wl.followedLeadNames) || !wl.followedLeadNames.every((s) => typeof s === 'string')) {
    return { ok: false, error: friendly };
  }
  if (!Array.isArray(wl.alerts) || !wl.alerts.every(isValidAlert)) {
    return { ok: false, error: friendly };
  }
  if (wl.lastCheckedAt !== null && wl.lastCheckedAt !== undefined && typeof wl.lastCheckedAt !== 'string') {
    return { ok: false, error: friendly };
  }

  if (typeof settings.welcomeDismissed !== 'boolean') {
    return { ok: false, error: friendly };
  }
  const discoverTypeFilter = isDiscoverTypeFilter(settings.discoverTypeFilter)
    ? settings.discoverTypeFilter
    : 'all';

  const watchlistOnly =
    typeof filters.watchlistOnly === 'boolean'
      ? filters.watchlistOnly
      : isStatusFilter(filters.upcomingStatus)
        ? filters.upcomingStatus === 'followed'
        : null;
  if (
    watchlistOnly === null ||
    !isPlatformFilterList(filters.upcomingPlatforms) ||
    !isSortKey(filters.upcomingSort)
  ) {
    return { ok: false, error: friendly };
  }
  const upcomingStatus: StatusFilter = watchlistOnly ? 'followed' : 'all';

  const watched = parsed.watched === undefined ? {} : parsed.watched;
  if (!isPlainObject(watched)) {
    return { ok: false, error: friendly };
  }

  return {
    ok: true,
    backup: {
      app: 'couch',
      version: 1,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
      watchlist: {
        follows: wl.follows,
        followedLeadNames: wl.followedLeadNames,
        alerts: wl.alerts.slice(0, 30),
        lastCheckedAt: wl.lastCheckedAt ?? null,
      },
      watched: sanitizeWatched(watched),
      settings: {
        welcomeDismissed: settings.welcomeDismissed,
        discoverTypeFilter,
        hideWatched: settings.hideWatched === true,
      },
      filters: {
        watchlistOnly,
        upcomingStatus,
        upcomingPlatforms: filters.upcomingPlatforms,
        upcomingSort: filters.upcomingSort,
      },
    },
  };
}

export function applyCouchBackupToStorage(backup: CouchBackup) {
  saveFollows(backup.watchlist.follows);
  saveAlerts(backup.watchlist.alerts);
  try {
    localStorage.setItem(FOLLOWED_LEADS_STORAGE_KEY, JSON.stringify(backup.watchlist.followedLeadNames));
    if (backup.watchlist.lastCheckedAt) {
      localStorage.setItem(LAST_CHECK_KEY, backup.watchlist.lastCheckedAt);
    } else {
      localStorage.removeItem(LAST_CHECK_KEY);
    }
    if (backup.settings.hideWatched) localStorage.setItem(HIDE_WATCHED_KEY, 'true');
    else localStorage.removeItem(HIDE_WATCHED_KEY);
    if (backup.settings.welcomeDismissed) {
      localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
    } else {
      localStorage.removeItem(WELCOME_DISMISSED_KEY);
    }
  } catch {
    // ignore
  }
  writeWatchlistOnly(backup.filters.watchlistOnly);
  writeStorage(PLATFORM_STORAGE_KEY, backup.filters.upcomingPlatforms);
  writeStorage(SORT_STORAGE_KEY, backup.filters.upcomingSort);
  writeWatchedFromBackup(backup.watched);
}

export function couchBackupFilename(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5).replace(':', '');
  return `couch-backup-${date}-${time}.json`;
}

export function downloadJsonFile(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
