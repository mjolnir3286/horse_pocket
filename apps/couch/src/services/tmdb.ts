import { RELAY_URL, TMDB_IMAGE_BASE, WATCH_REGION } from '../config/relay';

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

/** Movies and shows in one search, like a TV's universal search. */
export async function searchTitles(query: string, signal?: AbortSignal): Promise<TmdbTitle[]> {
  const data = await relayGet<{ results: RawResult[] }>(
    '/search/multi',
    { query, include_adult: 'false', language: 'en-US', page: '1' },
    signal
  );
  return data.results
    .map((r) => toTitle(r))
    .filter((t): t is TmdbTitle => t !== null);
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
  const data = await relayGet<{
    results: Record<string, { link?: string; flatrate?: RawProvider[]; free?: RawProvider[]; ads?: RawProvider[]; rent?: RawProvider[]; buy?: RawProvider[] }>;
  }>(`/${type}/${id}/watch/providers`, {}, signal);
  const us = data.results?.[WATCH_REGION];
  if (!us) return EMPTY_WATCH_OPTIONS;
  return {
    link: us.link ?? null,
    stream: mapProviders(us.flatrate),
    free: mapProviders(us.free),
    ads: mapProviders(us.ads),
    rent: mapProviders(us.rent),
    buy: mapProviders(us.buy),
  };
}

export async function getTvExternalIds(id: number): Promise<{ imdbId: string | null; tvdbId: number | null }> {
  const data = await relayGet<{ imdb_id?: string | null; tvdb_id?: number | null }>(`/tv/${id}/external_ids`);
  return { imdbId: data.imdb_id || null, tvdbId: data.tvdb_id ?? null };
}

/** TMDB's most popular titles currently streaming (flatrate) on the given US providers. */
export async function getPopularOnProvider(
  type: TmdbMediaType,
  providerIds: number[],
  count = 3
): Promise<TmdbTitle[]> {
  const data = await relayGet<{ results: RawResult[] }>(`/discover/${type}`, {
    watch_region: WATCH_REGION,
    with_watch_providers: providerIds.join('|'),
    with_watch_monetization_types: 'flatrate',
    sort_by: 'popularity.desc',
    include_adult: 'false',
    language: 'en-US',
    page: '1',
  });
  return data.results
    .map((r) => toTitle(r, type))
    .filter((t): t is TmdbTitle => t !== null)
    .slice(0, count);
}
