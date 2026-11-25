import type { PlatformId } from './streaming';

export type LeadAvailabilityStatus = 'upcoming' | 'available-now';

export interface UpcomingReleaseLead {
  id: string;
  showTitle: string;
  platformId: PlatformId | 'unknown';
  platformName: string;
  rawHeadline: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
  extractedDateText: string | null;
  parsedDateIso: string | null;
  datePrecision: 'exact' | 'vague' | 'none';
  confirmationStatus: 'confirmed' | 'unconfirmed';
  availabilityStatus: LeadAvailabilityStatus;
  confidenceScore: number;
  matchedKeywords: string[];
  tvmaze?: {
    showId: number;
    matchedName: string;
    webChannel?: string;
    nextEpisodeAirDate?: string;
    nextEpisodeName?: string;
    nextEpisodeSeason?: number;
    nextEpisodeNumber?: number;
  };
}

export interface CollectorOutput {
  generatedAt: string;
  feedsPolled: Array<{ name: string; url: string; status: 'ok' | 'error'; itemCount: number }>;
  totalRawItems: number;
  totalLeads: number;
  upcomingCount: number;
  availableNowCount: number;
  leads: UpcomingReleaseLead[];
}
