import type { UpcomingReleaseLead } from '../src/types/collector';
import type { PlatformId } from '../src/types/streaming';
import { computeAvailabilityStatus, leadId, polishTitle } from './titleUtils';

export const TVMAZE_USER_AGENT =
  'HorsePocket/1.0 (+https://github.com/mjolnir3286/horse_pocket)';

const TVMAZE_BASE = 'https://api.tvmaze.com';
const WINDOW_MS = 10_000;
const MAX_CALLS_PER_WINDOW = 18;

const WEB_CHANNEL_MAP: Array<{ id: PlatformId; name: string; patterns: RegExp[] }> = [
  { id: 'netflix', name: 'Netflix', patterns: [/^netflix$/i] },
  { id: 'disney-plus', name: 'Disney+', patterns: [/^disney\+$/i, /^disney plus$/i] },
  { id: 'hulu', name: 'Hulu', patterns: [/^hulu$/i] },
  {
    id: 'prime-video',
    name: 'Amazon Prime Video',
    patterns: [/^prime video$/i, /^amazon prime video$/i, /^amazon prime$/i],
  },
  { id: 'max', name: 'HBO Max (Max)', patterns: [/^hbo max$/i, /^max$/i] },
  { id: 'apple-tv-plus', name: 'Apple TV+', patterns: [/^apple tv\+?$/i] },
  { id: 'peacock', name: 'Peacock', patterns: [/^peacock$/i] },
  { id: 'paramount-plus', name: 'Paramount+', patterns: [/^paramount\+$/i, /^paramount plus$/i] },
];

const recentCallTimes: number[] = [];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function respectRateLimit() {
  const now = Date.now();
  while (recentCallTimes.length && now - recentCallTimes[0] >= WINDOW_MS) {
    recentCallTimes.shift();
  }
  if (recentCallTimes.length >= MAX_CALLS_PER_WINDOW) {
    const waitFor = WINDOW_MS - (now - recentCallTimes[0]) + 50;
    await sleep(Math.max(50, waitFor));
    return respectRateLimit();
  }
  recentCallTimes.push(Date.now());
}

export async function tvmazeFetch(pathAndQuery: string, retries = 4): Promise<Response> {
  await respectRateLimit();
  const url = pathAndQuery.startsWith('http') ? pathAndQuery : `${TVMAZE_BASE}${pathAndQuery}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': TVMAZE_USER_AGENT,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    if (retries > 0) {
      await sleep(1000 * (5 - retries));
      return tvmazeFetch(pathAndQuery, retries - 1);
    }
    throw err;
  }

  if (res.status === 429) {
    const retryAfterHeader = res.headers.get('Retry-After');
    const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
      ? retryAfterSec * 1000
      : 1500 * Math.pow(2, 5 - retries);
    if (retries > 0) {
      console.warn(`[tvmaze] 429 received; backing off ${Math.round(waitMs)}ms`);
      await sleep(waitMs);
      return tvmazeFetch(pathAndQuery, retries - 1);
    }
  }

  return res;
}

export function mapWebChannel(channelName: string | undefined | null): {
  id: PlatformId;
  name: string;
} | null {
  if (!channelName) return null;
  const trimmed = channelName.trim();
  for (const entry of WEB_CHANNEL_MAP) {
    if (entry.patterns.some((re) => re.test(trimmed))) {
      return { id: entry.id, name: entry.name };
    }
  }
  return null;
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dateRange(around: Date, pastDays: number, futureDays: number): string[] {
  const dates: string[] = [];
  for (let offset = -pastDays; offset <= futureDays; offset += 1) {
    const day = new Date(around);
    day.setDate(around.getDate() + offset);
    dates.push(formatLocalDate(day));
  }
  return dates;
}

interface TvMazeEmbeddedShow {
  id: number;
  name: string;
  url?: string;
  webChannel?: { name: string } | null;
  network?: { name: string } | null;
}

interface TvMazeScheduleEpisode {
  id: number;
  name?: string;
  url?: string;
  season?: number;
  number?: number;
  airdate?: string;
  _embedded?: { show?: TvMazeEmbeddedShow };
  show?: TvMazeEmbeddedShow;
}

export interface TvMazeScheduleFetchResult {
  feeds: Array<{ name: string; url: string; status: 'ok' | 'error'; itemCount: number }>;
  rawItemCount: number;
  leads: UpcomingReleaseLead[];
}

async function fetchScheduleForDate(
  date: string,
  country: '' | 'US'
): Promise<{ url: string; items: TvMazeScheduleEpisode[]; ok: boolean }> {
  const params = new URLSearchParams({ date });
  params.set('country', country);
  const url = `${TVMAZE_BASE}/schedule/web?${params.toString()}`;
  try {
    const res = await tvmazeFetch(url);
    if (!res.ok) {
      console.warn(`[tvmaze] ${url} failed with HTTP ${res.status}`);
      return { url, items: [], ok: false };
    }
    const data = (await res.json()) as unknown;
    return { url, items: Array.isArray(data) ? (data as TvMazeScheduleEpisode[]) : [], ok: true };
  } catch (err) {
    console.warn(`[tvmaze] ${url} failed:`, (err as Error).message);
    return { url, items: [], ok: false };
  }
}

function episodeToLead(episode: TvMazeScheduleEpisode, now: Date, nowIso: string): UpcomingReleaseLead | null {
  const show = episode._embedded?.show ?? episode.show;
  if (!show?.name) return null;
  const channelName = show.webChannel?.name ?? show.network?.name;
  const platform = mapWebChannel(channelName);
  if (!platform) return null;

  const showTitle = polishTitle(show.name);
  const airdate = episode.airdate || null;
  const season = episode.season;
  const number = episode.number;
  const epName = episode.name || 'Episode';
  const headline =
    season != null && number != null
      ? `${showTitle} S${season}E${number}: ${epName}`
      : `${showTitle}: ${epName}`;

  return {
    id: leadId(showTitle, platform.id),
    showTitle,
    platformId: platform.id,
    platformName: platform.name,
    rawHeadline: headline,
    sourceName: 'TVmaze web schedule',
    sourceUrl: episode.url || show.url || 'https://www.tvmaze.com',
    publishedAt: airdate ? `${airdate}T00:00:00.000Z` : nowIso,
    firstSeenAt: nowIso,
    lastSeenAt: nowIso,
    extractedDateText: airdate,
    parsedDateIso: airdate,
    datePrecision: airdate ? 'exact' : 'none',
    confirmationStatus: 'confirmed',
    availabilityStatus: computeAvailabilityStatus(airdate, now),
    confidenceScore: 0.99,
    matchedKeywords: ['tvmaze-schedule'],
    tvmaze: {
      showId: show.id,
      matchedName: show.name,
      webChannel: channelName ?? undefined,
      nextEpisodeAirDate: airdate ?? undefined,
      nextEpisodeName: epName,
      nextEpisodeSeason: season,
      nextEpisodeNumber: number,
    },
  };
}

/**
 * Prefer the soonest upcoming episode for a show+platform; if none remain,
 * keep the most recently aired one (available now). Never drop either class of date.
 */
function preferScheduleLead(existing: UpcomingReleaseLead, incoming: UpcomingReleaseLead): UpcomingReleaseLead {
  const a = existing.parsedDateIso;
  const b = incoming.parsedDateIso;
  const today = formatLocalDate(new Date());

  const aUpcoming = Boolean(a && a >= today);
  const bUpcoming = Boolean(b && b >= today);

  if (aUpcoming && bUpcoming) {
    return a! <= b! ? existing : incoming;
  }
  if (aUpcoming) return existing;
  if (bUpcoming) return incoming;
  if (a && b) return a >= b ? existing : incoming;
  return incoming.confidenceScore >= existing.confidenceScore ? incoming : existing;
}

export async function fetchTvMazeScheduleLeads(
  now: Date,
  pastDays = 7,
  futureDays = 14
): Promise<TvMazeScheduleFetchResult> {
  const nowIso = now.toISOString();
  const dates = dateRange(now, pastDays, futureDays);
  const feeds: TvMazeScheduleFetchResult['feeds'] = [];
  const byId = new Map<string, UpcomingReleaseLead>();
  let rawItemCount = 0;
  let globalOk = 0;
  let usOk = 0;
  let globalItems = 0;
  let usItems = 0;

  for (const date of dates) {
    const global = await fetchScheduleForDate(date, '');
    const us = await fetchScheduleForDate(date, 'US');

    if (global.ok) {
      globalOk += 1;
      globalItems += global.items.length;
    }
    if (us.ok) {
      usOk += 1;
      usItems += us.items.length;
    }
    rawItemCount += global.items.length + us.items.length;

    const seenEpisode = new Set<number>();
    for (const episode of [...global.items, ...us.items]) {
      if (seenEpisode.has(episode.id)) continue;
      seenEpisode.add(episode.id);
      const lead = episodeToLead(episode, now, nowIso);
      if (!lead) continue;
      const prev = byId.get(lead.id);
      byId.set(lead.id, prev ? preferScheduleLead(prev, lead) : lead);
    }
  }

  feeds.push({
    name: 'TVmaze web schedule (global)',
    url: `${TVMAZE_BASE}/schedule/web?country=&date=${dates[0]}…${dates[dates.length - 1]}`,
    status: globalOk > 0 ? 'ok' : 'error',
    itemCount: globalItems,
  });
  feeds.push({
    name: 'TVmaze web schedule (US)',
    url: `${TVMAZE_BASE}/schedule/web?country=US&date=${dates[0]}…${dates[dates.length - 1]}`,
    status: usOk > 0 ? 'ok' : 'error',
    itemCount: usItems,
  });

  return { feeds, rawItemCount, leads: Array.from(byId.values()) };
}

export interface TvMazeLookup {
  showId: number;
  matchedName: string;
  webChannel?: string;
  nextEpisodeAirDate?: string;
  nextEpisodeName?: string;
  nextEpisodeSeason?: number;
  nextEpisodeNumber?: number;
}

export async function lookupTvMazeShow(showTitle: string): Promise<TvMazeLookup | undefined> {
  if (!showTitle || showTitle.length < 3 || showTitle.split(' ').length > 6) {
    return undefined;
  }
  try {
    const url = `/singlesearch/shows?q=${encodeURIComponent(showTitle)}&embed=nextepisode`;
    const res = await tvmazeFetch(url);
    if (!res.ok) return undefined;

    interface TvMazeShow {
      id: number;
      name: string;
      webChannel?: { name: string } | null;
      network?: { name: string } | null;
      _embedded?: {
        nextepisode?: {
          name?: string;
          season?: number;
          number?: number;
          airdate?: string;
        };
      };
    }

    const data = (await res.json()) as TvMazeShow;
    const normQuery = showTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normMatch = data.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!normMatch.includes(normQuery) && !normQuery.includes(normMatch)) {
      return undefined;
    }

    const nextEp = data._embedded?.nextepisode;
    return {
      showId: data.id,
      matchedName: data.name,
      webChannel: data.webChannel?.name ?? data.network?.name ?? undefined,
      nextEpisodeAirDate: nextEp?.airdate || undefined,
      nextEpisodeName: nextEp?.name || undefined,
      nextEpisodeSeason: nextEp?.season,
      nextEpisodeNumber: nextEp?.number,
    };
  } catch {
    return undefined;
  }
}
