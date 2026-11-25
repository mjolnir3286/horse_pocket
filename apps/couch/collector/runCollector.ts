import fs from 'node:fs';
import path from 'node:path';
import * as chrono from 'chrono-node';
import { XMLParser } from 'fast-xml-parser';
import type { CollectorOutput, UpcomingReleaseLead } from '../src/types/collector';
import type { PlatformId } from '../src/types/streaming';
import {
  computeAvailabilityStatus,
  leadId,
  mergeLead,
  polishTitle,
  pruneStaleLeads,
  AVAILABLE_NOW_KEEP_DAYS,
} from './titleUtils';
import { fetchTvMazeScheduleLeads, lookupTvMazeShow, TVMAZE_USER_AGENT } from './tvmazeClient';

interface FeedConfig {
  name: string;
  url: string;
}

const FEEDS: FeedConfig[] = [
  {
    name: 'Google News: Season Premieres',
    url: 'https://news.google.com/rss/search?q=%22season%20premiere%22%20(Netflix%20OR%20Hulu%20OR%20Disney%2B%20OR%20%22Prime%20Video%22%20OR%20%22HBO%20Max%22)&hl=en-US&gl=US&ceid=US:en',
  },
  {
    name: 'Google News: Streaming Release Dates',
    url: 'https://news.google.com/rss/search?q=(%22coming%20to%20Netflix%22%20OR%20%22coming%20to%20Hulu%22%20OR%20%22coming%20to%20Disney%2B%22%20OR%20%22new%20season%22)%20%22release%20date%22&hl=en-US&gl=US&ceid=US:en',
  },
  {
    name: 'Google News: Apple TV+ / Peacock / Paramount+',
    url: 'https://news.google.com/rss/search?q=(%22premieres%22%20OR%20%22new%20season%22)%20(%22Apple%20TV%22%20OR%20Peacock%20OR%20%22Paramount%2B%22)&hl=en-US&gl=US&ceid=US:en',
  },
  {
    name: 'Deadline',
    url: 'https://deadline.com/feed/',
  },
  {
    name: 'Variety TV',
    url: 'https://variety.com/v/tv/feed/',
  },
  {
    name: 'TVLine',
    url: 'https://tvline.com/feed/',
  },
];

const PLATFORM_MATCHERS: Array<{ id: PlatformId; name: string; patterns: RegExp[] }> = [
  { id: 'netflix', name: 'Netflix', patterns: [/\bnetflix\b/i] },
  { id: 'disney-plus', name: 'Disney+', patterns: [/\bdisney\+/i, /\bdisney plus\b/i] },
  { id: 'hulu', name: 'Hulu', patterns: [/\bhulu\b/i] },
  {
    id: 'prime-video',
    name: 'Amazon Prime Video',
    patterns: [/\bprime video\b/i, /\bamazon prime\b/i],
  },
  {
    id: 'max',
    name: 'HBO Max (Max)',
    patterns: [/\bhbo max\b/i, /\bstreaming on max\b/i, /\bcoming to max\b/i, /\bon max\b/i, /\bmax's\b/i],
  },
  { id: 'apple-tv-plus', name: 'Apple TV+', patterns: [/\bapple tv\+?\b/i] },
  { id: 'peacock', name: 'Peacock', patterns: [/\bpeacock\b/i] },
  { id: 'paramount-plus', name: 'Paramount+', patterns: [/\bparamount\+/i, /\bparamount plus\b/i] },
];

const KEYWORD_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'season premiere', regex: /\bseason\s+\d*\s*premiere\b|\bseason premiere\b/i },
  { label: 'series premiere', regex: /\bseries premiere\b/i },
  { label: 'premieres', regex: /\bpremieres?\b/i },
  { label: 'new season', regex: /\bnew season\b|\bseason\s+\d+\b/i },
  { label: 'release date', regex: /\brelease date\b|\bpremiere date\b/i },
  { label: 'coming to platform', regex: /\bcoming to (netflix|hulu|disney|prime|max|hbo|apple|peacock|paramount)/i },
  { label: 'returns', regex: /\breturns\b/i },
];

const VAGUE_DATE_REGEX =
  /\b(this\s+(?:spring|summer|fall|autumn|winter|week|month)|early\s+202\d|late\s+202\d|mid-?202\d|coming\s+soon|next\s+(?:year|month|season|week)|spring\s+202\d|summer\s+202\d|fall\s+202\d|winter\s+202\d)\b/i;

const EXPLICIT_MONTH_REGEX =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanHeadline(raw: string): string {
  // Strip Google News trailing " - Publisher Name"
  return raw.replace(/\s+-\s+[^-]{2,45}$/, '').trim();
}

function detectPlatform(text: string): { id: PlatformId | 'unknown'; name: string } {
  for (const p of PLATFORM_MATCHERS) {
    if (p.patterns.some((re) => re.test(text))) {
      return { id: p.id, name: p.name };
    }
  }
  return { id: 'unknown', name: 'Multi / Unspecified' };
}

function extractShowTitle(headline: string): string {
  const cleaned = cleanHeadline(headline);
  let extracted = cleaned;

  // 1. Quoted title: ‘Title’, 'Title', “Title”, "Title"
  const quoteMatch = cleaned.match(/[‘'“"]([^’'"”]{2,55})[’'"”]/);
  if (quoteMatch && quoteMatch[1]) {
    const candidate = quoteMatch[1].trim();
    if (!/^(season|premiere|release date|new season)$/i.test(candidate)) {
      extracted = candidate;
    }
  } else {
    // 2. "<Title> Season <N>" or "<Title> Premieres" or "<Title> Sets ... Date"
    const beforeSeason = cleaned.match(
      /^(.{2,55}?)\s+(?:Season\s+\d+|Series\s+Premiere|Season\s+Premiere|Premieres|Sets\s+.*?(?:Premiere|Release)|Release\s+Date|Returns\s+(?:With|For|To))/i
    );
    if (beforeSeason && beforeSeason[1]) {
      extracted = beforeSeason[1].replace(/^[:\-–—\s]+|[:\-–—\s]+$/g, '').trim();
    } else {
      // 3. Before colon / dash if concise
      const colonSplit = cleaned.split(/[:|–—]/)[0]?.trim();
      if (colonSplit && colonSplit.length >= 3 && colonSplit.length <= 45) {
        extracted = colonSplit;
      } else {
        extracted = cleaned.slice(0, 52);
      }
    }
  }

  return polishTitle(extracted);
}

function extractDateInfo(
  cleanedText: string,
  refDate: Date
): {
  extractedDateText: string | null;
  parsedDateIso: string | null;
  datePrecision: 'exact' | 'vague' | 'none';
} {
  const results = chrono.parse(cleanedText, refDate, { forwardDate: true });

  for (const res of results) {
    const hasMonth = res.start.isCertain('month');
    const hasDay = res.start.isCertain('day');
    // Only treat as exact calendar date if an explicit month name or numeric date is present
    const hasCalendarMonthOrSlash =
      EXPLICIT_MONTH_REGEX.test(res.text) || /\b\d{1,2}\/\d{1,2}/.test(res.text);
    if (hasMonth && hasDay && hasCalendarMonthOrSlash) {
      const d = res.start.date();
      return {
        extractedDateText: res.text,
        parsedDateIso: d.toISOString().slice(0, 10),
        datePrecision: 'exact',
      };
    }
  }

  const vagueMatch = cleanedText.match(VAGUE_DATE_REGEX);
  if (vagueMatch) {
    return {
      extractedDateText: vagueMatch[0],
      parsedDateIso: null,
      datePrecision: 'vague',
    };
  }

  for (const res of results) {
    if (EXPLICIT_MONTH_REGEX.test(res.text) || /\b202\d\b/.test(res.text)) {
      return {
        extractedDateText: res.text,
        parsedDateIso: null,
        datePrecision: 'vague',
      };
    }
  }

  return {
    extractedDateText: null,
    parsedDateIso: null,
    datePrecision: 'none',
  };
}

async function fetchRssItems(feed: FeedConfig) {
  const res = await fetch(feed.url, {
    headers: { 'User-Agent': TVMAZE_USER_AGENT },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { item?: unknown } };
    feed?: { entry?: unknown };
  };

  const rawItems = parsed.rss?.channel?.item ?? parsed.feed?.entry ?? [];
  const list = Array.isArray(rawItems) ? rawItems : [rawItems];
  return list as Array<Record<string, unknown>>;
}

function asString(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && '#text' in val) {
    return String((val as Record<string, unknown>)['#text'] ?? '');
  }
  return '';
}

async function run() {
  const now = new Date();
  const feedsPolled: CollectorOutput['feedsPolled'] = [];
  const candidates: UpcomingReleaseLead[] = [];
  let totalRawItems = 0;
  let tvmazeScheduleLeadCount = 0;
  let rssLeadCount = 0;

  console.log('[collector] Fetching TVmaze web/streaming schedules (global + US, past 7 to next 14 days)…');
  const tvmaze = await fetchTvMazeScheduleLeads(now, 7, 14);
  feedsPolled.push(...tvmaze.feeds);
  totalRawItems += tvmaze.rawItemCount;
  tvmazeScheduleLeadCount = tvmaze.leads.length;
  candidates.push(...tvmaze.leads);
  console.log(
    `[collector] TVmaze schedule: ${tvmaze.rawItemCount} raw episodes -> ${tvmazeScheduleLeadCount} mapped leads on tracked platforms`
  );

  for (const feed of FEEDS) {
    try {
      const items = await fetchRssItems(feed);
      totalRawItems += items.length;
      feedsPolled.push({ name: feed.name, url: feed.url, status: 'ok', itemCount: items.length });

      for (const raw of items) {
        const rawTitle = stripHtml(asString(raw.title));
        const cleanedHeadline = cleanHeadline(rawTitle);
        const rawDesc = stripHtml(asString(raw.description ?? raw.summary));
        const cleanDesc = cleanHeadline(rawDesc);
        const link =
          asString(raw.link) ||
          (raw.link && typeof raw.link === 'object' && '@_href' in raw.link
            ? String((raw.link as Record<string, unknown>)['@_href'])
            : '');
        const pubDateStr = asString(raw.pubDate ?? raw.published ?? raw.updated);
        const pubDate = pubDateStr ? new Date(pubDateStr) : now;
        const refDate = Number.isNaN(pubDate.getTime()) ? now : pubDate;

        const combinedText = `${cleanedHeadline}. ${cleanDesc}`;
        const matchedKeywords = KEYWORD_PATTERNS.filter((k) => k.regex.test(combinedText)).map(
          (k) => k.label
        );
        const platform = detectPlatform(combinedText);

        if (matchedKeywords.length === 0) continue;
        if (platform.id === 'unknown' && matchedKeywords.length < 2) continue;

        const showTitle = extractShowTitle(rawTitle);
        const dateInfo = extractDateInfo(combinedText, refDate);

        let score = 0.2;
        score += Math.min(0.25, matchedKeywords.length * 0.12);
        if (platform.id !== 'unknown') score += 0.25;
        if (showTitle.length >= 3 && showTitle.length <= 45) score += 0.12;
        if (dateInfo.datePrecision === 'exact') score += 0.2;
        else if (dateInfo.datePrecision === 'vague') score += 0.06;

        const nowIso = refDate.toISOString();
        const id = leadId(showTitle, platform.id) || `lead-${candidates.length}`;
        candidates.push({
          id,
          showTitle,
          platformId: platform.id,
          platformName: platform.name,
          rawHeadline: rawTitle,
          sourceName: feed.name,
          sourceUrl: link,
          publishedAt: nowIso,
          firstSeenAt: nowIso,
          lastSeenAt: nowIso,
          extractedDateText: dateInfo.extractedDateText,
          parsedDateIso: dateInfo.parsedDateIso,
          datePrecision: dateInfo.datePrecision,
          confirmationStatus: 'unconfirmed',
          availabilityStatus: computeAvailabilityStatus(dateInfo.parsedDateIso, now),
          confidenceScore: Number(Math.min(0.95, score).toFixed(2)),
          matchedKeywords,
        });
      }
    } catch (err) {
      feedsPolled.push({
        name: feed.name,
        url: feed.url,
        status: 'error',
        itemCount: 0,
      });
      console.warn(`[collector] Failed feed ${feed.name}:`, (err as Error).message);
    }
  }

  rssLeadCount = candidates.length - tvmazeScheduleLeadCount;

  const publicOut = path.resolve(process.cwd(), 'public/data/upcoming-releases.json');
  const nowIso = now.toISOString();

  const existingLeads = loadExistingLeads(publicOut, nowIso);

  const incomingMap = new Map<string, UpcomingReleaseLead>();
  for (const lead of candidates) {
    const existing = incomingMap.get(lead.id);
    incomingMap.set(lead.id, existing ? mergeLead(existing, lead, nowIso) : lead);
  }

  const mergedMap = new Map<string, UpcomingReleaseLead>();
  for (const lead of existingLeads) {
    mergedMap.set(lead.id, lead);
  }
  for (const lead of incomingMap.values()) {
    const prev = mergedMap.get(lead.id);
    mergedMap.set(lead.id, prev ? mergeLead(prev, lead, nowIso) : lead);
  }

  // Re-clean titles, re-key after polish, and refresh availability (never drop past dates).
  const rekeyed = new Map<string, UpcomingReleaseLead>();
  for (const lead of mergedMap.values()) {
    const cleanedTitle = polishTitle(lead.showTitle);
    const id = leadId(cleanedTitle, lead.platformId) || lead.id;
    const updated: UpcomingReleaseLead = {
      ...lead,
      id,
      showTitle: cleanedTitle,
      availabilityStatus: computeAvailabilityStatus(lead.parsedDateIso, now),
    };
    const prev = rekeyed.get(id);
    rekeyed.set(id, prev ? mergeLead(prev, updated, nowIso) : updated);
  }

  let allLeads = Array.from(rekeyed.values()).sort((a, b) => b.confidenceScore - a.confidenceScore);

  // Confirm remaining RSS leads via TVmaze singlesearch (no key). Schedule leads are already confirmed.
  const confirmQueue = [
    ...allLeads.filter((l) => l.sourceName !== 'TVmaze web schedule' && l.availabilityStatus === 'upcoming' && !l.tvmaze),
    ...allLeads.filter((l) => l.sourceName !== 'TVmaze web schedule' && l.availabilityStatus === 'available-now' && !l.tvmaze),
  ].slice(0, 30);

  let rssConfirmed = 0;
  for (const lead of confirmQueue) {
    const lookup = await lookupTvMazeShow(lead.showTitle);
    if (lookup) {
      lead.tvmaze = lookup;
      if (lookup.nextEpisodeAirDate) {
        lead.confirmationStatus = 'confirmed';
        lead.parsedDateIso = lookup.nextEpisodeAirDate;
        lead.datePrecision = 'exact';
        lead.confidenceScore = Number(Math.min(0.99, lead.confidenceScore + 0.18).toFixed(2));
        rssConfirmed += 1;
      } else if (lead.datePrecision === 'exact') {
        lead.confidenceScore = Number(Math.min(0.96, lead.confidenceScore + 0.1).toFixed(2));
      }
      lead.availabilityStatus = computeAvailabilityStatus(lead.parsedDateIso, now);
    }
  }

  const beforePrune = allLeads.length;
  allLeads = pruneStaleLeads(allLeads, now);
  console.log(`[collector] Pruned ${beforePrune - allLeads.length} available-now leads older than ${AVAILABLE_NOW_KEEP_DAYS} days`);
  allLeads.sort((a, b) => b.confidenceScore - a.confidenceScore);
  const upcomingCount = allLeads.filter((l) => l.availabilityStatus === 'upcoming').length;
  const availableNowCount = allLeads.filter((l) => l.availabilityStatus === 'available-now').length;

  const output: CollectorOutput = {
    generatedAt: nowIso,
    feedsPolled,
    totalRawItems,
    totalLeads: allLeads.length,
    upcomingCount,
    availableNowCount,
    leads: allLeads,
  };

  fs.mkdirSync(path.dirname(publicOut), { recursive: true });
  fs.writeFileSync(publicOut, JSON.stringify(output, null, 2));

  const wwwDir = path.resolve(process.cwd(), 'www/data');
  if (fs.existsSync(path.resolve(process.cwd(), 'www'))) {
    fs.mkdirSync(wwwDir, { recursive: true });
    fs.writeFileSync(path.join(wwwDir, 'upcoming-releases.json'), JSON.stringify(output, null, 2));
  }

  const confirmedCount = allLeads.filter((l) => l.confirmationStatus === 'confirmed').length;
  const tvmazeInMerged = allLeads.filter((l) => l.sourceName === 'TVmaze web schedule').length;

  console.log(
    `[collector] Done. TVmaze schedule leads=${tvmazeScheduleLeadCount} (raw episodes=${tvmaze.rawItemCount}); RSS leads this run=${rssLeadCount}; RSS confirmed via TVmaze=${rssConfirmed}; merged historical total=${allLeads.length} (${upcomingCount} upcoming, ${availableNowCount} available now, ${confirmedCount} confirmed, ${tvmazeInMerged} from TVmaze schedule) -> ${publicOut}`
  );
  for (const l of allLeads.slice(0, 12)) {
    console.log(
      `  • [${l.availabilityStatus === 'available-now' ? 'AVAILABLE NOW' : 'UPCOMING'} ${l.confirmationStatus.toUpperCase()} ${l.confidenceScore}] ${l.showTitle} | ${l.platformName} | date=${l.parsedDateIso ?? l.extractedDateText ?? 'none'} (${l.datePrecision}) | src=${l.sourceName}`
    );
  }
}

function loadExistingLeads(filePath: string, nowIso: string): UpcomingReleaseLead[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<CollectorOutput>;
    const leads = Array.isArray(parsed.leads) ? parsed.leads : [];
    return leads.map((lead) => {
      const cleanedTitle = polishTitle(lead.showTitle || '');
      const parsedDateIso = lead.parsedDateIso ?? null;
      return {
        ...lead,
        id: leadId(cleanedTitle, lead.platformId || 'unknown') || lead.id,
        showTitle: cleanedTitle,
        firstSeenAt: lead.firstSeenAt || lead.publishedAt || nowIso,
        lastSeenAt: lead.lastSeenAt || nowIso,
        confirmationStatus: lead.confirmationStatus === 'confirmed' ? 'confirmed' : 'unconfirmed',
        availabilityStatus: computeAvailabilityStatus(parsedDateIso),
        matchedKeywords: lead.matchedKeywords || [],
        confidenceScore: lead.confidenceScore ?? 0,
        datePrecision: lead.datePrecision || 'none',
        extractedDateText: lead.extractedDateText ?? null,
        parsedDateIso,
        rawHeadline: lead.rawHeadline || '',
        sourceName: lead.sourceName || '',
        sourceUrl: lead.sourceUrl || '',
        publishedAt: lead.publishedAt || nowIso,
        platformId: lead.platformId || 'unknown',
        platformName: lead.platformName || 'Multi / Unspecified',
      } as UpcomingReleaseLead;
    });
  } catch (err) {
    console.warn('[collector] Could not read existing leads file:', (err as Error).message);
    return [];
  }
}

run().catch((err) => {
  console.error('[collector] Fatal error:', err);
  process.exit(1);
});
