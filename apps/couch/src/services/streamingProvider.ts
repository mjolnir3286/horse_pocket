import { MOCK_CATALOG } from '../data/mockCatalog';
import { MOCK_PLATFORMS } from '../data/mockPlatforms';
import type {
  MediaTitle,
  MediaType,
  NewEpisodeAlert,
  PlatformId,
  StreamingPlatform,
} from '../types/streaming';
import { getConfiguredTmdbApiKey, TmdbStreamingProvider } from './tmdbProvider';

export interface SearchQuery {
  text?: string;
  type?: MediaType | 'all';
  platformId?: PlatformId | 'all';
}

/**
 * Provider interface for Horse Pocket.
 * Designed around TMDB's API (/search/multi, /tv/{id}/watch/providers,
 * /movie/{id}/watch/providers, /discover/tv - JustWatch-sourced).
 */
export interface StreamingProvider {
  readonly providerName: string;
  readonly isMockData: boolean;
  searchTitles(query: SearchQuery): Promise<MediaTitle[]>;
  getAllTitles(): Promise<MediaTitle[]>;
  getTitleById(id: string): Promise<MediaTitle | undefined>;
  getPlatforms(): Promise<StreamingPlatform[]>;
  getPlatformById(id: PlatformId): Promise<StreamingPlatform | undefined>;
  getTopShowsForPlatform(id: PlatformId): Promise<MediaTitle[]>;
  checkNewEpisodes(followedTitleIds: string[]): Promise<NewEpisodeAlert[]>;
}

const SIMULATED_RELEASES: Record<
  string,
  { season: number; episode: number; episodeTitle: string }
> = {
  'stranger-things': { season: 5, episode: 3, episodeTitle: 'Echoes Below' },
  'the-bear': { season: 4, episode: 6, episodeTitle: 'Eight-Top' },
  severance: { season: 2, episode: 10, episodeTitle: 'Inside Lumon' },
  'the-last-of-us': { season: 2, episode: 8, episodeTitle: 'The Aquarium' },
  fallout: { season: 2, episode: 5, episodeTitle: 'Vault 21' },
};

export class MockStreamingProvider implements StreamingProvider {
  readonly providerName = 'Example Catalog (Mock — TMDB Ready)';
  readonly isMockData = true;

  async getAllTitles(): Promise<MediaTitle[]> {
    return MOCK_CATALOG;
  }

  async searchTitles(query: SearchQuery): Promise<MediaTitle[]> {
    const q = (query.text || '').trim().toLowerCase();
    return MOCK_CATALOG.filter((item) => {
      if (query.type && query.type !== 'all' && item.type !== query.type) {
        return false;
      }
      if (
        query.platformId &&
        query.platformId !== 'all' &&
        !item.availability.some((a) => a.platformId === query.platformId)
      ) {
        return false;
      }
      if (!q) return true;
      const hay = [
        item.title,
        item.synopsis,
        ...item.genres,
        ...item.availability.map((a) => a.platformId),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  async getTitleById(id: string): Promise<MediaTitle | undefined> {
    return MOCK_CATALOG.find((item) => item.id === id);
  }

  async getPlatforms(): Promise<StreamingPlatform[]> {
    return MOCK_PLATFORMS;
  }

  async getPlatformById(id: PlatformId): Promise<StreamingPlatform | undefined> {
    return MOCK_PLATFORMS.find((p) => p.id === id);
  }

  async getTopShowsForPlatform(id: PlatformId): Promise<MediaTitle[]> {
    const platform = MOCK_PLATFORMS.find((p) => p.id === id);
    if (!platform) return [];
    return platform.top3ShowIds
      .map((showId) => MOCK_CATALOG.find((t) => t.id === showId))
      .filter((t): t is MediaTitle => Boolean(t));
  }

  async checkNewEpisodes(followedTitleIds: string[]): Promise<NewEpisodeAlert[]> {
    const now = new Date().toISOString();
    const alerts: NewEpisodeAlert[] = [];

    for (const id of followedTitleIds) {
      const show = MOCK_CATALOG.find((t) => t.id === id && t.type === 'series');
      if (!show) continue;

      const sim = SIMULATED_RELEASES[id];
      const platformId = show.availability[0]?.platformId ?? 'netflix';
      if (sim) {
        alerts.push({
          id: `${id}-s${sim.season}e${sim.episode}-${Date.now()}`,
          titleId: id,
          showTitle: show.title,
          platformId,
          season: sim.season,
          episode: sim.episode,
          episodeTitle: sim.episodeTitle,
          detectedAt: now,
          read: false,
        });
      } else if (show.ongoing && show.latestEpisode) {
        alerts.push({
          id: `${id}-s${show.latestEpisode.season}e${show.latestEpisode.episode + 1}-${Date.now()}`,
          titleId: id,
          showTitle: show.title,
          platformId,
          season: show.latestEpisode.season,
          episode: show.latestEpisode.episode + 1,
          episodeTitle: 'New Episode Available',
          detectedAt: now,
          read: false,
        });
      }
    }

    return alerts;
  }
}

const mockProvider = new MockStreamingProvider();
const tmdbApiKey = getConfiguredTmdbApiKey();

export const streamingProvider: StreamingProvider = tmdbApiKey
  ? new TmdbStreamingProvider(tmdbApiKey, mockProvider)
  : mockProvider;
