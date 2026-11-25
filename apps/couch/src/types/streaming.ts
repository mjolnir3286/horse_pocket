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
  /** Exact price text as published, e.g. "$8.99/mo". null = not verified. */
  monthlyPrice: string | null;
  annualPrice?: string | null;
  hasAds: boolean;
  notes?: string;
}

export interface StreamingPlatform {
  id: PlatformId;
  /** TMDB watch-provider ids (US) that count as this service. */
  tmdbProviderIds: number[];
  tier: PlatformPriorityTier;
  name: string;
  shortCode: string;
  brandColor: string;
  tagline: string;
  plans: PlatformPlan[];
  /** Official page the prices were read from. */
  pricingUrl: string;
  /** ISO date the prices were checked against pricingUrl. */
  pricesCheckedOn: string;
  pricingNote?: string;
  websiteUrl: string;
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
