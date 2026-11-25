import { cacheGet, cacheSet, dedupe } from '../lib/cache';

/** Browser-side TVmaze calls (free, no key, CC BY-SA). Used for episode tracking. */
const TVMAZE = 'https://api.tvmaze.com';
const STATUS_TTL_MS = 6 * 60 * 60 * 1000;
const LOOKUP_TTL_MS = 24 * 60 * 60 * 1000;
const STATUS_STORE = 'couch_tvmaze_status_v1';
const LOOKUP_STORE = 'couch_tvmaze_lookup_v1';

export interface TvmazeEpisode {
  id: number;
  season: number;
  number: number | null;
  name: string;
  airdate: string | null;
  airstamp: string | null;
}

export interface TvmazeShowStatus {
  id: number;
  name: string;
  status: string;
  network: string | null;
  url: string;
  previous: TvmazeEpisode | null;
  next: TvmazeEpisode | null;
  fetchedAt: string;
}

interface RawEpisode {
  id: number;
  season: number;
  number: number | null;
  name?: string;
  airdate?: string;
  airstamp?: string;
}

function toEpisode(e?: RawEpisode | null): TvmazeEpisode | null {
  if (!e) return null;
  return {
    id: e.id,
    season: e.season,
    number: e.number ?? null,
    name: e.name || 'Episode',
    airdate: e.airdate || null,
    airstamp: e.airstamp || null,
  };
}

/** Find a TVmaze show from the IMDb id TMDB gives us (fallback: TheTVDB id). Cached 24 hours. */
export async function lookupTvmazeId(ids: { imdbId: string | null; tvdbId: number | null }): Promise<number | null> {
  const key = `${ids.imdbId ?? ''}:${ids.tvdbId ?? ''}`;
  const cached = cacheGet<number | null>('local', LOOKUP_STORE, key);
  if (cached !== undefined) return cached;
  return dedupe(`lookup:${key}`, async () => {
    const again = cacheGet<number | null>('local', LOOKUP_STORE, key);
    if (again !== undefined) return again;
    const tries: string[] = [];
    if (ids.imdbId) tries.push(`imdb=${encodeURIComponent(ids.imdbId)}`);
    if (ids.tvdbId) tries.push(`thetvdb=${ids.tvdbId}`);
    for (const q of tries) {
      try {
        const res = await fetch(`${TVMAZE}/lookup/shows?${q}`);
        if (res.ok) {
          const show = (await res.json()) as { id?: number };
          if (show.id) {
            cacheSet('local', LOOKUP_STORE, key, show.id, LOOKUP_TTL_MS);
            return show.id;
          }
        }
      } catch {
        // try the next id
      }
    }
    cacheSet('local', LOOKUP_STORE, key, null, LOOKUP_TTL_MS);
    return null;
  });
}

export async function getShowStatus(tvmazeId: number, force = false): Promise<TvmazeShowStatus> {
  const key = String(tvmazeId);
  if (!force) {
    const cached = cacheGet<TvmazeShowStatus>('local', STATUS_STORE, key);
    if (cached) return cached;
  }
  return dedupe(`status:${key}:${force ? 'force' : 'normal'}`, async () => {
    if (!force) {
      const again = cacheGet<TvmazeShowStatus>('local', STATUS_STORE, key);
      if (again) return again;
    }
    const res = await fetch(`${TVMAZE}/shows/${tvmazeId}?embed[]=nextepisode&embed[]=previousepisode`);
    if (!res.ok) throw new Error(`TVmaze HTTP ${res.status}`);
    const s = (await res.json()) as {
      id: number;
      name: string;
      status?: string;
      url?: string;
      network?: { name: string } | null;
      webChannel?: { name: string } | null;
      _embedded?: { nextepisode?: RawEpisode; previousepisode?: RawEpisode };
    };
    const status: TvmazeShowStatus = {
      id: s.id,
      name: s.name,
      status: s.status || 'Unknown',
      network: s.webChannel?.name ?? s.network?.name ?? null,
      url: s.url || `https://www.tvmaze.com/shows/${s.id}`,
      previous: toEpisode(s._embedded?.previousepisode),
      next: toEpisode(s._embedded?.nextepisode),
      fetchedAt: new Date().toISOString(),
    };
    cacheSet('local', STATUS_STORE, key, status, STATUS_TTL_MS);
    return status;
  });
}
