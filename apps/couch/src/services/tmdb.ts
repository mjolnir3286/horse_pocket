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
/** One shared cache for /discover pages, used by Discover rows and Platforms cards. */
const DISCOVER_STORE = 'couch_tmdb_discover_v1';
/** Short cache for seasons TMDB has no provider page for (404), so reopening doesn't re-ask. */
const SEASON_MISS_TTL_MS = 6 * 60 * 60 * 1000;
const EXIDS_STORE = 'couch_tmdb_external_ids_v1';
const SEASONS_STORE = 'couch_tmdb_seasons_v1';
const SEASON_PROVIDER_STORE = 'couch_tmdb_season_providers_v1';
const RECS_STORE = 'couch_tmdb_recommendations_v1';
const ROW_STORE = 'couch_tmdb_rows_v2';
// Older caches replaced by DISCOVER_STORE / ROW_STORE v2; drop them once.
try {
  localStorage.removeItem('couch_tmdb_popular_v1');
  localStorage.removeItem('couch_tmdb_rows_v1');
} catch {
  // storage blocked
}
/** Subscription, free, and free-with-ads: anything but rent/buy. */
const WATCHABLE_TYPES = 'flatrate|free|ads';

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

export function peekPopularOnProvider(type: TmdbMediaType, providerIds: number[], count = 3): TmdbTitle[] | undefined {
  return peekDiscover(type, providerIds)?.slice(0, count);
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

type RawRegionProviders = { link?: string; flatrate?: RawProvider[]; free?: RawProvider[]; ads?: RawProvider[]; rent?: RawProvider[]; buy?: RawProvider[] };

function toWatchOptions(us: RawRegionProviders | undefined): WatchOptions {
  return !us
    ? EMPTY_WATCH_OPTIONS
    : {
        link: us.link ?? null,
        stream: mapProviders(us.flatrate),
        free: mapProviders(us.free),
        ads: mapProviders(us.ads),
        rent: mapProviders(us.rent),
        buy: mapProviders(us.buy),
      };
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
    const options = toWatchOptions(data.results?.[WATCH_REGION]);
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

/** TMDB's most popular titles watchable (subscription, free, or with ads) on the given US providers. Cached 24 hours. */
export async function getPopularOnProvider(
  type: TmdbMediaType,
  providerIds: number[],
  count = 3
): Promise<TmdbTitle[]> {
  return (await discoverPage(type, providerIds)).slice(0, count);
}

export interface TmdbSeason {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
}

/** A show's seasons from TMDB /tv/{id} (already allowlisted). Cached 24 hours. */
export async function getTvSeasons(id: number): Promise<TmdbSeason[]> {
  const key = String(id);
  const cached = cacheGet<TmdbSeason[]>('local', SEASONS_STORE, key);
  if (cached) return cached;
  return dedupe(`seasons:${key}`, async () => {
    const again = cacheGet<TmdbSeason[]>('local', SEASONS_STORE, key);
    if (again) return again;
    const data = await relayGet<{
      seasons?: Array<{ season_number: number; name?: string; episode_count?: number; air_date?: string | null }>;
    }>(`/tv/${id}`, { language: 'en-US' });
    const seasons = (data.seasons ?? []).map((s) => ({
      seasonNumber: s.season_number,
      name: s.name || `Season ${s.season_number}`,
      episodeCount: s.episode_count ?? 0,
      airDate: s.air_date || null,
    }));
    cacheSet('local', SEASONS_STORE, key, seasons, DETAILS_TTL_MS);
    return seasons;
  });
}

export function hasAnyWatchOption(o: WatchOptions): boolean {
  return o.stream.length + o.free.length + o.ads.length + o.rent.length + o.buy.length > 0;
}

/**
 * US where-to-watch for one season (TMDB /tv/{id}/season/{n}/watch/providers). Cached 24 hours.
 * Returns EMPTY_WATCH_OPTIONS when TMDB has nothing for the season, so callers can fall back
 * to the show-level list.
 */
export async function getSeasonWatchOptions(id: number, season: number, signal?: AbortSignal): Promise<WatchOptions> {
  const key = `${id}-${season}`;
  const cached = cacheGet<WatchOptions>('local', SEASON_PROVIDER_STORE, key);
  if (cached) return cached;
  return dedupe(`season-providers:${key}`, async () => {
    const again = cacheGet<WatchOptions>('local', SEASON_PROVIDER_STORE, key);
    if (again) return again;
    let options: WatchOptions;
    try {
      const data = await relayGet<{ results?: Record<string, RawRegionProviders> }>(
        `/tv/${id}/season/${season}/watch/providers`,
        {},
        signal
      );
      options = toWatchOptions(data.results?.[WATCH_REGION]);
    } catch (err) {
      // Unknown season (or an older relay without this route): fall back, and remember the miss briefly.
      if (err instanceof RelayError && err.status === 404) {
        cacheSet('local', SEASON_PROVIDER_STORE, key, EMPTY_WATCH_OPTIONS, SEASON_MISS_TTL_MS);
        return EMPTY_WATCH_OPTIONS;
      }
      throw err;
    }
    cacheSet('local', SEASON_PROVIDER_STORE, key, options, DETAILS_TTL_MS);
    return options;
  });
}

export function peekRecommendations(type: TmdbMediaType, id: number): TmdbTitle[] | undefined {
  return cacheGet<TmdbTitle[]>('local', RECS_STORE, `${type}-${id}`);
}

/** TMDB recommendations for one title (/movie|tv/{id}/recommendations). Cached 24 hours. */
export async function getRecommendations(type: TmdbMediaType, id: number): Promise<TmdbTitle[]> {
  const key = `${type}-${id}`;
  const cached = cacheGet<TmdbTitle[]>('local', RECS_STORE, key);
  if (cached) return cached;
  return dedupe(`recs:${key}`, async () => {
    const again = cacheGet<TmdbTitle[]>('local', RECS_STORE, key);
    if (again) return again;
    const data = await relayGet<{ results?: RawResult[] }>(`/${type}/${id}/recommendations`, {
      language: 'en-US',
      page: '1',
    });
    const titles = (data.results ?? [])
      .map((r) => toTitle(r, type))
      .filter((t): t is TmdbTitle => t !== null)
      .slice(0, 12);
    cacheSet('local', RECS_STORE, key, titles, DETAILS_TTL_MS);
    return titles;
  });
}

export type RowType = 'all' | TmdbMediaType;
const ROW_SIZE = 20;

function mergeByPopularity(lists: TmdbTitle[][]): TmdbTitle[] {
  const seen = new Set<string>();
  return lists
    .flat()
    .sort((a, b) => b.popularity - a.popularity)
    .filter((t) => {
      const k = `${t.mediaType}-${t.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, ROW_SIZE)
    .map(trimOverview);
}

/** Rows are cached per service and type, so keep stored overviews short. */
function trimOverview(t: TmdbTitle): TmdbTitle {
  return t.overview.length > 400 ? { ...t, overview: `${t.overview.slice(0, 397).trimEnd()}…` } : t;
}

function rowKey(kind: string, type: RowType, providerIds: number[] = []): string {
  return `${kind}:${type}:${providerIds.slice().sort((a, b) => a - b).join('|')}`;
}

function discoverKey(type: TmdbMediaType, providerIds: number[]): string {
  return `${type}:${sortedIds(providerIds)}`;
}

function sortedIds(providerIds: number[]): string {
  return providerIds.slice().sort((a, b) => a - b).join('|');
}

function peekDiscover(type: TmdbMediaType, providerIds: number[]): TmdbTitle[] | undefined {
  return cacheGet<TmdbTitle[]>('local', DISCOVER_STORE, discoverKey(type, providerIds));
}

function rowFrom(lists: TmdbTitle[][]): TmdbTitle[] {
  return lists.length === 1 ? lists[0].slice(0, ROW_SIZE) : mergeByPopularity(lists);
}

export function peekServiceRow(type: RowType, providerIds: number[]): TmdbTitle[] | undefined {
  const types: TmdbMediaType[] = type === 'all' ? ['tv', 'movie'] : [type];
  const lists = types.map((t) => peekDiscover(t, providerIds));
  return lists.every((l): l is TmdbTitle[] => !!l) ? rowFrom(lists) : undefined;
}

/** Page 1 of /discover/{type} for these providers, shared by every caller. Cached 24 hours. */
async function discoverPage(type: TmdbMediaType, providerIds: number[]): Promise<TmdbTitle[]> {
  const key = discoverKey(type, providerIds);
  const cached = cacheGet<TmdbTitle[]>('local', DISCOVER_STORE, key);
  if (cached) return cached;
  return dedupe(`discover:${key}`, async () => {
    const again = cacheGet<TmdbTitle[]>('local', DISCOVER_STORE, key);
    if (again) return again;
    const data = await relayGet<{ results?: RawResult[] }>(`/discover/${type}`, {
      watch_region: WATCH_REGION,
      with_watch_providers: sortedIds(providerIds),
      with_watch_monetization_types: WATCHABLE_TYPES,
      sort_by: 'popularity.desc',
      include_adult: 'false',
      language: 'en-US',
      page: '1',
    });
    const titles = (data.results ?? [])
      .map((r) => toTitle(r, type))
      .filter((t): t is TmdbTitle => t !== null)
      .slice(0, ROW_SIZE)
      .map(trimOverview);
    cacheSet('local', DISCOVER_STORE, key, titles, DETAILS_TTL_MS);
    return titles;
  });
}

/** "Popular on <Service>" row for Discover: shows, movies, or both merged by popularity. Cached 24 hours. */
export async function getServiceRow(type: RowType, providerIds: number[]): Promise<TmdbTitle[]> {
  const types: TmdbMediaType[] = type === 'all' ? ['tv', 'movie'] : [type];
  return rowFrom(await Promise.all(types.map((t) => discoverPage(t, providerIds))));
}

export function peekTrendingRow(type: RowType): TmdbTitle[] | undefined {
  return cacheGet<TmdbTitle[]>('local', ROW_STORE, rowKey('trending', type));
}

/** TMDB trending this week (/trending/{all|movie|tv}/week). Cached 24 hours. */
export async function getTrendingRow(type: RowType): Promise<TmdbTitle[]> {
  const key = rowKey('trending', type);
  const cached = cacheGet<TmdbTitle[]>('local', ROW_STORE, key);
  if (cached) return cached;
  return dedupe(`row:${key}`, async () => {
    const again = cacheGet<TmdbTitle[]>('local', ROW_STORE, key);
    if (again) return again;
    const data = await relayGet<{ results?: RawResult[] }>(`/trending/${type}/week`, { language: 'en-US' });
    const titles = (data.results ?? [])
      .map((r) => toTitle(r, type === 'all' ? undefined : type))
      .filter((t): t is TmdbTitle => t !== null)
      .slice(0, ROW_SIZE)
      .map(trimOverview);
    cacheSet('local', ROW_STORE, key, titles, DETAILS_TTL_MS);
    return titles;
  });
}
