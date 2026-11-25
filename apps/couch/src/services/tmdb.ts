import { RELAY_URL, TMDB_IMAGE_BASE, WATCH_REGION } from '../config/relay';
import { cacheGet, cacheSet, dedupe } from '../lib/cache';

export type TmdbMediaType = 'movie' | 'tv';

export interface TmdbTitle {
  id: number;
  mediaType: TmdbMediaType;
  title: string;
  year: string | null;
  overview: string;
  posterPath: string | null;
  popularity: number;
}

export interface ProviderOption {
  id: number;
  name: string;
  logoPath: string | null;
}

/** US where-to-watch options for one title (TMDB watch providers, data by JustWatch). */
export interface WatchOptions {
  link: string | null;
  stream: ProviderOption[];
  free: ProviderOption[];
  ads: ProviderOption[];
  rent: ProviderOption[];
  buy: ProviderOption[];
}

export const EMPTY_WATCH_OPTIONS: WatchOptions = {
  link: null,
  stream: [],
  free: [],
  ads: [],
  rent: [],
  buy: [],
};

export class RelayError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

const SEARCH_TTL_MS = 30 * 60 * 1000;
const DETAILS_TTL_MS = 24 * 60 * 60 * 1000;
const SEARCH_STORE = 'couch_tmdb_search_v1';
const PROVIDER_STORE = 'couch_tmdb_providers_v1';
const POPULAR_STORE = 'couch_tmdb_popular_v1';
const EXIDS_STORE = 'couch_tmdb_external_ids_v1';

async function relayGet<T>(path: string, params: Record<string, string> = {}, signal?: AbortSignal): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${RELAY_URL}/tmdb${path}${qs ? `?${qs}` : ''}`, { signal });
  if (!res.ok) throw new RelayError(`Relay HTTP ${res.status}`, res.status);
  return (await res.json()) as T;
}

export function posterUrl(path: string | null, size: 'w92' | 'w185' | 'w342' = 'w185'): string | null {
  return path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;
}

export function logoUrl(path: string | null): string | null {
  return path ? `${TMDB_IMAGE_BASE}/w92${path}` : null;
}

export function searchCacheKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function peekWatchOptions(type: TmdbMediaType, id: number): WatchOptions | undefined {
  return cacheGet<WatchOptions>('local', PROVIDER_STORE, `${type}-${id}`);
}

export function popularCacheKey(type: TmdbMediaType, providerIds: number[], count = 3): string {
  return `${type}:${providerIds.slice().sort((a, b) => a - b).join('|')}:${count}`;
}

export function peekPopularOnProvider(type: TmdbMediaType, providerIds: number[], count = 3): TmdbTitle[] | undefined {
  return cacheGet<TmdbTitle[]>('local', POPULAR_STORE, popularCacheKey(type, providerIds, count));
}

interface RawResult {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  popularity?: number;
}

function toTitle(r: RawResult, fallbackType?: TmdbMediaType): TmdbTitle | null {
  const mediaType = (r.media_type as TmdbMediaType | undefined) ?? fallbackType;
  if (mediaType !== 'movie' && mediaType !== 'tv') return null;
  const date = mediaType === 'movie' ? r.release_date : r.first_air_date;
  return {
    id: r.id,
    mediaType,
    title: (mediaType === 'movie' ? r.title : r.name) || r.title || r.name || 'Untitled',
    year: date ? date.slice(0, 4) : null,
    overview: r.overview || '',
    posterPath: r.poster_path ?? null,
    popularity: r.popularity ?? 0,
  };
}

/** Movies and shows in one search. Cached in localStorage for 30 minutes (shared across tabs). */
export async function searchTitles(query: string, signal?: AbortSignal): Promise<TmdbTitle[]> {
  const key = searchCacheKey(query);
  const cached = cacheGet<TmdbTitle[]>('local', SEARCH_STORE, key);
  if (cached) return cached;
  return dedupe(`search:${key}`, async () => {
    const again = cacheGet<TmdbTitle[]>('local', SEARCH_STORE, key);
    if (again) return again;
    const data = await relayGet<{ results: RawResult[] }>(
      '/search/multi',
      { query: key, include_adult: 'false', language: 'en-US', page: '1' },
      signal
    );
    const titles = data.results
      .map((r) => toTitle(r))
      .filter((t): t is TmdbTitle => t !== null);
    cacheSet('local', SEARCH_STORE, key, titles, SEARCH_TTL_MS);
    return titles;
  });
}

interface RawProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
}

function mapProviders(list?: RawProvider[]): ProviderOption[] {
  return (list ?? []).map((p) => ({ id: p.provider_id, name: p.provider_name, logoPath: p.logo_path }));
}

export async function getWatchOptions(type: TmdbMediaType, id: number, signal?: AbortSignal): Promise<WatchOptions> {
  const key = `${type}-${id}`;
  const cached = cacheGet<WatchOptions>('local', PROVIDER_STORE, key);
  if (cached) return cached;
  return dedupe(`providers:${key}`, async () => {
    const again = cacheGet<WatchOptions>('local', PROVIDER_STORE, key);
    if (again) return again;
    const data = await relayGet<{
      results: Record<
        string,
        { link?: string; flatrate?: RawProvider[]; free?: RawProvider[]; ads?: RawProvider[]; rent?: RawProvider[]; buy?: RawProvider[] }
      >;
    }>(`/${type}/${id}/watch/providers`, {}, signal);
    const us = data.results?.[WATCH_REGION];
    const options: WatchOptions = !us
      ? EMPTY_WATCH_OPTIONS
      : {
          link: us.link ?? null,
          stream: mapProviders(us.flatrate),
          free: mapProviders(us.free),
          ads: mapProviders(us.ads),
          rent: mapProviders(us.rent),
          buy: mapProviders(us.buy),
        };
    cacheSet('local', PROVIDER_STORE, key, options, DETAILS_TTL_MS);
    return options;
  });
}

export async function getTvExternalIds(id: number): Promise<{ imdbId: string | null; tvdbId: number | null }> {
  const key = String(id);
  const cached = cacheGet<{ imdbId: string | null; tvdbId: number | null }>('local', EXIDS_STORE, key);
  if (cached) return cached;
  return dedupe(`exids:${key}`, async () => {
    const again = cacheGet<{ imdbId: string | null; tvdbId: number | null }>('local', EXIDS_STORE, key);
    if (again) return again;
    const data = await relayGet<{ imdb_id?: string | null; tvdb_id?: number | null }>(`/tv/${id}/external_ids`);
    const ids = { imdbId: data.imdb_id || null, tvdbId: data.tvdb_id ?? null };
    cacheSet('local', EXIDS_STORE, key, ids, DETAILS_TTL_MS);
    return ids;
  });
}

/** TMDB's most popular titles currently streaming (flatrate) on the given US providers. Cached 24 hours. */
export async function getPopularOnProvider(
  type: TmdbMediaType,
  providerIds: number[],
  count = 3
): Promise<TmdbTitle[]> {
  const key = popularCacheKey(type, providerIds, count);
  const cached = cacheGet<TmdbTitle[]>('local', POPULAR_STORE, key);
  if (cached) return cached;
  return dedupe(`popular:${key}`, async () => {
    const again = cacheGet<TmdbTitle[]>('local', POPULAR_STORE, key);
    if (again) return again;
    const data = await relayGet<{ results: RawResult[] }>(`/discover/${type}`, {
      watch_region: WATCH_REGION,
      with_watch_providers: providerIds.join('|'),
      with_watch_monetization_types: 'flatrate',
      sort_by: 'popularity.desc',
      include_adult: 'false',
      language: 'en-US',
      page: '1',
    });
    const titles = data.results
      .map((r) => toTitle(r, type))
      .filter((t): t is TmdbTitle => t !== null)
      .slice(0, count);
    cacheSet('local', POPULAR_STORE, key, titles, DETAILS_TTL_MS);
    return titles;
  });
}
