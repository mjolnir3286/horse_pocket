import { MOCK_PLATFORMS } from '../data/mockPlatforms';
import type {
  MediaTitle,
  NewEpisodeAlert,
  PlatformAvailability,
  PlatformId,
  StreamingPlatform,
} from '../types/streaming';
import type { SearchQuery, StreamingProvider } from './streamingProvider';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';

const TMDB_PROVIDER_ID_MAP = new Map<number, PlatformId>(
  MOCK_PLATFORMS.map((p) => [p.tmdbProviderId, p.id])
);

export function getConfiguredTmdbApiKey(): string | undefined {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const fromEnv = env?.VITE_TMDB_API_KEY || env?.TMDB_API_KEY;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();

  if (typeof window !== 'undefined') {
    const fromWindow = (window as unknown as { TMDB_API_KEY?: string }).TMDB_API_KEY;
    if (fromWindow && fromWindow.trim()) return fromWindow.trim();
  }
  return undefined;
}

interface TmdbWatchProvidersCountry {
  flatrate?: Array<{ provider_id: number; provider_name: string }>;
  rent?: Array<{ provider_id: number; provider_name: string }>;
  buy?: Array<{ provider_id: number; provider_name: string }>;
}

/**
 * TMDB API adapter (JustWatch-sourced /watch/providers endpoints).
 * Activates automatically when VITE_TMDB_API_KEY (or window.TMDB_API_KEY) is set;
 * falls back cleanly to MockStreamingProvider on errors or missing key.
 */
export class TmdbStreamingProvider implements StreamingProvider {
  readonly providerName = 'TMDB Watch Providers (JustWatch-sourced)';
  readonly isMockData = false;

  private readonly apiKey: string;
  private readonly region: string;
  private readonly fallback: StreamingProvider;

  constructor(apiKey: string, fallback: StreamingProvider, region = 'US') {
    this.apiKey = apiKey;
    this.fallback = fallback;
    this.region = region;
  }

  private async tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${TMDB_BASE}${path}`);
    url.searchParams.set('api_key', this.apiKey);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`TMDB HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  }

  private mapWatchProviders(country?: TmdbWatchProvidersCountry): PlatformAvailability[] {
    if (!country) return [];
    const out: PlatformAvailability[] = [];
    const seen = new Set<PlatformId>();

    for (const item of country.flatrate ?? []) {
      const pid = TMDB_PROVIDER_ID_MAP.get(item.provider_id);
      if (pid && !seen.has(pid)) {
        seen.add(pid);
        out.push({ platformId: pid, accessType: 'subscription', quality: 'HD' });
      }
    }
    for (const item of country.rent ?? []) {
      const pid = TMDB_PROVIDER_ID_MAP.get(item.provider_id);
      if (pid && !seen.has(pid)) {
        seen.add(pid);
        out.push({ platformId: pid, accessType: 'rent', quality: 'HD' });
      }
    }
    for (const item of country.buy ?? []) {
      const pid = TMDB_PROVIDER_ID_MAP.get(item.provider_id);
      if (pid && !seen.has(pid)) {
        seen.add(pid);
        out.push({ platformId: pid, accessType: 'buy', quality: 'HD' });
      }
    }
    return out;
  }

  async getAllTitles(): Promise<MediaTitle[]> {
    return this.fallback.getAllTitles();
  }

  async searchTitles(query: SearchQuery): Promise<MediaTitle[]> {
    const q = (query.text || '').trim();
    if (!q) {
      return this.fallback.searchTitles(query);
    }

    try {
      interface SearchResp {
        results: Array<{
          id: number;
          media_type: 'tv' | 'movie' | 'person';
          name?: string;
          title?: string;
          overview?: string;
          first_air_date?: string;
          release_date?: string;
          vote_average?: number;
          poster_path?: string | null;
        }>;
      }

      const data = await this.tmdbFetch<SearchResp>('/search/multi', {
        query: q,
        include_adult: 'false',
      });

      const candidates = data.results
        .filter((r) => r.media_type === 'tv' || r.media_type === 'movie')
        .filter((r) => {
          if (!query.type || query.type === 'all') return true;
          return query.type === 'series' ? r.media_type === 'tv' : r.media_type === 'movie';
        })
        .slice(0, 10);

      const enriched = await Promise.all(
        candidates.map(async (item): Promise<MediaTitle> => {
          const mediaPath = item.media_type === 'tv' ? 'tv' : 'movie';
          const wp = await this.tmdbFetch<{ results?: Record<string, TmdbWatchProvidersCountry> }>(
            `/${mediaPath}/${item.id}/watch/providers`
          ).catch(() => ({ results: undefined }));

          const availability = this.mapWatchProviders(wp.results?.[this.region]);
          const titleText = item.name || item.title || 'Untitled';
          const dateStr = item.first_air_date || item.release_date || '2026';

          return {
            id: `tmdb-${mediaPath}-${item.id}`,
            tmdbId: item.id,
            title: titleText,
            type: item.media_type === 'tv' ? 'series' : 'movie',
            releaseYear: Number(dateStr.slice(0, 4)) || 2026,
            ongoing: item.media_type === 'tv',
            genres: [item.media_type === 'tv' ? 'Series' : 'Movie'],
            rating: 'NR',
            score: Number((item.vote_average ?? 0).toFixed(1)),
            synopsis: item.overview || 'No synopsis returned by TMDB.',
            posterGradient: ['#312e81', '#0f172a'],
            posterInitials: titleText.slice(0, 2).toUpperCase(),
            posterUrl: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : undefined,
            availability,
          };
        })
      );

      if (query.platformId && query.platformId !== 'all') {
        return enriched.filter((t) =>
          t.availability.some((a) => a.platformId === query.platformId)
        );
      }
      return enriched;
    } catch {
      return this.fallback.searchTitles(query);
    }
  }

  async getTitleById(id: string): Promise<MediaTitle | undefined> {
    return this.fallback.getTitleById(id);
  }

  async getPlatforms(): Promise<StreamingPlatform[]> {
    return this.fallback.getPlatforms();
  }

  async getPlatformById(id: PlatformId): Promise<StreamingPlatform | undefined> {
    return this.fallback.getPlatformById(id);
  }

  async getTopShowsForPlatform(id: PlatformId): Promise<MediaTitle[]> {
    const platform = await this.getPlatformById(id);
    if (!platform) return [];

    try {
      interface DiscoverResp {
        results: Array<{
          id: number;
          name: string;
          overview: string;
          first_air_date?: string;
          vote_average?: number;
          poster_path?: string | null;
        }>;
      }

      const data = await this.tmdbFetch<DiscoverResp>('/discover/tv', {
        watch_region: this.region,
        with_watch_providers: String(platform.tmdbProviderId),
        sort_by: 'popularity.desc',
      });

      const top3 = data.results.slice(0, 3).map((item): MediaTitle => ({
        id: `tmdb-tv-${item.id}`,
        tmdbId: item.id,
        title: item.name,
        type: 'series',
        releaseYear: Number((item.first_air_date || '2026').slice(0, 4)) || 2026,
        ongoing: true,
        genres: ['Popular'],
        rating: 'TV',
        score: Number((item.vote_average ?? 0).toFixed(1)),
        synopsis: item.overview || 'Popular title on this platform via TMDB.',
        posterGradient: ['#1e1b4b', '#0f172a'],
        posterInitials: item.name.slice(0, 2).toUpperCase(),
        posterUrl: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : undefined,
        availability: [{ platformId: id, accessType: 'subscription', quality: 'HD' }],
      }));

      return top3.length === 3 ? top3 : this.fallback.getTopShowsForPlatform(id);
    } catch {
      return this.fallback.getTopShowsForPlatform(id);
    }
  }

  async checkNewEpisodes(followedTitleIds: string[]): Promise<NewEpisodeAlert[]> {
    // Production note: pair TMDB /tv/{id} next_episode_to_air checks on a backend cron
    // with Web Push (VAPID) / FCM. Falling back to local simulation here.
    return this.fallback.checkNewEpisodes(followedTitleIds);
  }
}
