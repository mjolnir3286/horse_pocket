export type PlatformId =
  | 'netflix'
  | 'disney-plus'
  | 'hulu'
  | 'prime-video'
  | 'max'
  | 'apple-tv-plus'
  | 'peacock'
  | 'paramount-plus';

export type PlatformPriorityTier = 'priority' | 'secondary';

export interface PlatformPlan {
  name: string;
  monthlyPrice: string;
  annualNote?: string;
  hasAds: boolean;
  notes: string;
}

export interface StreamingPlatform {
  id: PlatformId;
  tmdbProviderId: number;
  tier: PlatformPriorityTier;
  name: string;
  shortCode: string;
  brandColor: string;
  tagline: string;
  subscriptionRequired: boolean;
  subscriptionNote: string;
  pricingDisclaimer: string;
  plans: PlatformPlan[];
  top3ShowIds: [string, string, string];
  websiteUrl: string;
}

export type MediaType = 'series' | 'movie';
export type AccessType = 'subscription' | 'rent' | 'buy' | 'addon';

export interface PlatformAvailability {
  platformId: PlatformId;
  accessType: AccessType;
  quality: 'HD' | '4K UHD';
  note?: string;
}

export interface EpisodeInfo {
  season: number;
  episode: number;
  title: string;
  airDate: string; // ISO YYYY-MM-DD
  isNew?: boolean;
}

export interface MediaTitle {
  id: string;
  tmdbId?: number;
  title: string;
  type: MediaType;
  releaseYear: number;
  endYear?: number;
  ongoing?: boolean;
  genres: string[];
  rating: string;
  score: number;
  synopsis: string;
  posterGradient: [string, string];
  posterInitials: string;
  posterUrl?: string;
  availability: PlatformAvailability[];
  latestEpisode?: EpisodeInfo;
  upcomingEpisode?: EpisodeInfo;
}

export interface NewEpisodeAlert {
  id: string;
  titleId: string;
  showTitle: string;
  platformId: PlatformId;
  season: number;
  episode: number;
  episodeTitle: string;
  detectedAt: string;
  read: boolean;
}
