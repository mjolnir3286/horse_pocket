import type { NewEpisodeAlert } from '../types/streaming';
import { getTvExternalIds, type TmdbMediaType } from './tmdb';
import { getShowStatus, lookupTvmazeId, type TvmazeEpisode } from './tvmaze';

/**
 * Follows live only in this browser (localStorage). Each follow is stored by id:
 * TMDB id for search/where-to-watch and TVmaze id for episode tracking.
 */
export interface FollowedTitle {
  key: string; // "tv-1399", "movie-438631", or "tvmaze-82" for Upcoming follows without a TMDB match
  mediaType: TmdbMediaType;
  tmdbId: number | null;
  tvmazeId: number | null;
  title: string;
  year: string | null;
  posterPath: string | null;
  followedAt: string;
  /** Last aired episode we've already accounted for. Only newer ones notify. */
  lastNotifiedEpisodeId: number | null;
  lastNotifiedAirstamp: string | null;
  lastStatus?: {
    checkedAt: string;
    network: string | null;
    showStatus: string;
    tvmazeUrl: string;
    previous: TvmazeEpisode | null;
    next: TvmazeEpisode | null;
  };
  /** true when no TVmaze match could be found, so episode alerts aren't possible. */
  untracked?: boolean;
}

const FOLLOWS_KEY = 'couch_follows_v1';
const ALERTS_KEY = 'couch_alerts_v1';
const LAST_CHECK_KEY = 'couch_last_episode_check_v1';
/** Old example-data watchlist (mock slugs like "stranger-things"); can't be mapped safely, so it's dropped. */
const LEGACY_MOCK_WATCHLIST_KEY = 'horse_pocket_watchlist_v2';
const LEGACY_PREMIUM_KEY = 'horse_pocket_premium_preview_v1';

export function followKey(type: TmdbMediaType, tmdbId: number): string {
  return `${type}-${tmdbId}`;
}

export function loadFollows(): FollowedTitle[] {
  try {
    localStorage.removeItem(LEGACY_MOCK_WATCHLIST_KEY);
    localStorage.removeItem(LEGACY_PREMIUM_KEY);
    const raw = localStorage.getItem(FOLLOWS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? (parsed as FollowedTitle[]).filter((f) => f && typeof f.key === 'string' && typeof f.title === 'string')
      : [];
  } catch {
    return [];
  }
}

export function saveFollows(follows: FollowedTitle[]) {
  try {
    localStorage.setItem(FOLLOWS_KEY, JSON.stringify(follows));
  } catch {
    // storage full or blocked; follows stay in memory for this visit
  }
}

export function loadAlerts(): NewEpisodeAlert[] {
  try {
    const raw = localStorage.getItem(ALERTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as NewEpisodeAlert[]) : [];
  } catch {
    return [];
  }
}

export function saveAlerts(alerts: NewEpisodeAlert[]) {
  try {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts.slice(0, 30)));
  } catch {
    // ignore
  }
}

export function readLastCheck(): string | null {
  try {
    return localStorage.getItem(LAST_CHECK_KEY);
  } catch {
    return null;
  }
}

function writeLastCheck(iso: string) {
  try {
    localStorage.setItem(LAST_CHECK_KEY, iso);
  } catch {
    // ignore
  }
}

/** Resolve a TMDB show to its TVmaze id via the IMDb id (or TheTVDB id) from TMDB external_ids. */
export async function resolveTvmazeId(tmdbTvId: number): Promise<number | null> {
  try {
    const ids = await getTvExternalIds(tmdbTvId);
    return await lookupTvmazeId(ids);
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Check every followed show on TVmaze. The first check after following only records a
 * baseline; after that, an alert is produced only for an aired episode we haven't seen.
 */
const CHECK_TTL_MS = 6 * 60 * 60 * 1000;

function isFresh(checkedAt?: string): boolean {
  if (!checkedAt) return false;
  const t = new Date(checkedAt).getTime();
  return Number.isFinite(t) && Date.now() - t < CHECK_TTL_MS;
}

/** Check followed shows. On open, skip a show if it was checked in the last 6 hours. Manual refresh passes force=true. */
export async function checkFollowedShows(
  follows: FollowedTitle[],
  force = false
): Promise<{ follows: FollowedTitle[]; alerts: NewEpisodeAlert[]; errors: number }> {
  const now = new Date().toISOString();
  const alerts: NewEpisodeAlert[] = [];
  let errors = 0;
  const updated: FollowedTitle[] = [];

  for (const original of follows) {
    let f = { ...original };
    if (f.mediaType !== 'tv') {
      updated.push(f);
      continue;
    }
    if (f.tvmazeId == null && f.tmdbId != null && !f.untracked) {
      const id = await resolveTvmazeId(f.tmdbId);
      f = id ? { ...f, tvmazeId: id } : { ...f, untracked: true };
    }
    if (f.tvmazeId == null) {
      updated.push(f);
      continue;
    }
    if (!force && isFresh(f.lastStatus?.checkedAt)) {
      updated.push(f);
      continue;
    }
    try {
      const status = await getShowStatus(f.tvmazeId, force);
      const prev = status.previous;
      if (prev) {
        if (f.lastNotifiedEpisodeId == null) {
          f.lastNotifiedEpisodeId = prev.id;
          f.lastNotifiedAirstamp = prev.airstamp;
        } else if (
          prev.id !== f.lastNotifiedEpisodeId &&
          (prev.airstamp ?? '') > (f.lastNotifiedAirstamp ?? '')
        ) {
          alerts.push({
            id: `ep-${prev.id}`,
            followKey: f.key,
            showTitle: f.title,
            season: prev.season,
            episode: prev.number ?? 0,
            episodeTitle: prev.name,
            airdate: prev.airdate,
            network: status.network,
            detectedAt: now,
          });
          f.lastNotifiedEpisodeId = prev.id;
          f.lastNotifiedAirstamp = prev.airstamp;
        }
      }
      f.lastStatus = {
        checkedAt: now,
        network: status.network,
        showStatus: status.status,
        tvmazeUrl: status.url,
        previous: status.previous,
        next: status.next,
      };
    } catch {
      errors += 1;
    }
    updated.push(f);
    await sleep(150); // stay well under TVmaze's 20 calls / 10 s
  }

  writeLastCheck(now);
  return { follows: updated, alerts, errors };
}
