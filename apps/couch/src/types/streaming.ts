export type PlatformId =
  | 'netflix'
  | 'prime-video'
  | 'disney-plus'
  | 'hulu'
  | 'max'
  | 'apple-tv-plus'
  | 'peacock'
  | 'paramount-plus'
  | 'starz'
  | 'mgm-plus'
  | 'amc-plus'
  | 'crunchyroll'
  | 'discovery-plus'
  | 'angel'
  | 'tubi'
  | 'pluto-tv'
  | 'roku-channel'
  | 'pbs'
  | 'investigation-discovery'
  | 'ae'
  | 'history'
  | 'lifetime'
  | 'abc'
  | 'nbc';

/** How the Platforms tab groups a service. */
export type PlatformGroup = 'subscription' | 'free' | 'network';

export interface StreamingPlatform {
  id: PlatformId;
  /** TMDB watch-provider ids (US) that count as this service (ad tiers and plan splits merged). */
  tmdbProviderIds: number[];
  group: PlatformGroup;
  name: string;
  shortCode: string;
  brandColor: string;
  /** TMDB provider logo path (served from image.tmdb.org). */
  logoPath: string | null;
  /** Official homepage. Prices live there, not in Couch. */
  websiteUrl: string;
  note?: string;
}

export interface NewEpisodeAlert {
  id: string;
  followKey: string;
  showTitle: string;
  season: number;
  episode: number;
  episodeTitle: string;
  airdate: string | null;
  network: string | null;
  detectedAt: string;
}
