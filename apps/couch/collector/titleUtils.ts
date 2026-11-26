import type { LeadAvailabilityStatus, UpcomingReleaseLead } from '../src/types/collector';

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function computeAvailabilityStatus(
  parsedDateIso: string | null | undefined,
  now = new Date()
): LeadAvailabilityStatus {
  if (parsedDateIso && parsedDateIso < todayIso(now)) {
    return 'available-now';
  }
  return 'upcoming';
}

/** "Available now" items stay in the feed this many days after their date, then drop off. */
export const AVAILABLE_NOW_KEEP_DAYS = 14;

export const SCHEDULE_SOURCE = 'TVmaze web schedule';

/** Kale's rule: keep shows whose TVmaze language is English or missing. */
export function isEnglishOrMissing(language: string | null | undefined): boolean {
  const l = language?.trim();
  return !l || l.toLowerCase() === 'english';
}

/** Normalized form for tight title comparison: drops "(US)" style tags, a leading "The", punctuation and case. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^\s*the\s+/, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Tight match: the two names are the same after normalizing. No substring matching. */
export function tightNameMatch(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  return na.length > 0 && na === normalizeTitle(b);
}

/** Quoted phrases in a headline, e.g. 'Stick,' 'Being Heumann' -> ["Stick", "Being Heumann"]. */
export function extractQuotedTitles(headline: string): string[] {
  const out: string[] = [];
  const re = /(?:^|[\s(\[:])[‘'“"]([^’'"”]{2,55})[’'"”](?=$|[\s,.;:!?)\]])/g;
  for (const m of headline.matchAll(re)) {
    const t = polishTitle(m[1].trim().replace(/[,;:]+$/g, ''));
    if (t.length >= 2 && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out;
}

/** Split a multi-title string on commas, "and" and "&". Returns [] if it names only one title. */
export function splitMultiTitle(title: string): string[] {
  const pieces = title
    .split(/\s*,\s*|\s+&\s+|\s+and\s+/i)
    .map((p) => p.trim().replace(/^(?:and|&)\s+/i, ''))
    .filter((p) => p.length >= 2 && p.length <= 45);
  return pieces.length > 1 ? pieces : [];
}

/** A lead is "matched" when TVmaze confirmed the show (schedule leads always are). */
export function isMatchedLead(lead: { sourceName?: string; tvmaze?: unknown }): boolean {
  return lead.sourceName === SCHEDULE_SOURCE || Boolean(lead.tvmaze);
}

/**
 * Expiry for the data file. Matched leads stay until 14 days after their release date, or, with no
 * date, 14 days after a feed last mentioned them. Sources in `exemptSources` (a failed or empty fetch)
 * skip the last-mention check so their last good items survive.
 */
export function pruneStaleLeads<
  T extends {
    availabilityStatus: string;
    parsedDateIso: string | null;
    lastSeenAt?: string;
    sourceName?: string;
  },
>(leads: T[], now = new Date(), keepDays = AVAILABLE_NOW_KEEP_DAYS, exemptSources: ReadonlySet<string> = new Set()): T[] {
  const cutoff = todayIso(new Date(now.getTime() - keepDays * 24 * 60 * 60 * 1000));
  return leads.filter((l) => {
    if (l.parsedDateIso) {
      return !(l.availabilityStatus === 'available-now' && l.parsedDateIso.slice(0, 10) < cutoff);
    }
    if (!l.lastSeenAt || (l.sourceName && exemptSources.has(l.sourceName))) return true;
    return l.lastSeenAt.slice(0, 10) >= cutoff;
  });
}

/**
 * Clean extracted titles: unwrap quotes, drop "First Last and Other Name's" prefixes,
 * and strip trailing premiere/release phrases.
 */
export function polishTitle(raw: string): string {
  let t = raw.trim();
  if (!t) return raw;

  t = t.replace(/^[‘'“"«]+|[’'"”»]+$/g, '').trim();

  const multiPossessive = t.match(
    /^.+?\s+and\s+.+?(?:'s|’s)\s+(.+)$/u
  );
  if (multiPossessive?.[1]) {
    t = multiPossessive[1].trim();
  } else {
    const personPossessive = t.match(
      /^[A-Z][\p{L}.'’-]+(?:\s+[A-Z][\p{L}.'’-]+)+(?:'s|’s)\s+(.+)$/u
    );
    if (personPossessive?.[1]) {
      t = personPossessive[1].trim();
    }
  }

  t = t.replace(
    /\s+(?:Season\s+\d+\b.*|(?:Series\s+)?Premieres?\b.*|Release Date\b.*|Returns\b.*|Hits\s+[\d.].*)$/i,
    ''
  );
  t = t.replace(/[‘'“”'"«»]/g, '').replace(/\s+/g, ' ').trim();
  t = t.replace(/[,;:]+$/g, '').trim();
  return t || raw.trim();
}

export function leadId(showTitle: string, platformId: string): string {
  const key = showTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${key}-${platformId}`;
}

export function mergeLead(
  prev: UpcomingReleaseLead,
  next: UpcomingReleaseLead,
  nowIso: string
): UpcomingReleaseLead {
  const preferNext =
    next.confidenceScore > prev.confidenceScore ||
    (next.confirmationStatus === 'confirmed' && prev.confirmationStatus !== 'confirmed');

  const parsedDateIso = preferDate(prev, next);
  const datePrecision =
    parsedDateIso && (next.datePrecision === 'exact' || prev.datePrecision === 'exact')
      ? 'exact'
      : preferNext
        ? next.datePrecision
        : prev.datePrecision;

  const merged: UpcomingReleaseLead = {
    ...(preferNext ? next : prev),
    id: next.id || prev.id,
    showTitle: polishTitle(preferNext ? next.showTitle : prev.showTitle),
    firstSeenAt: prev.firstSeenAt || next.firstSeenAt || nowIso,
    lastSeenAt: next.lastSeenAt || nowIso,
    parsedDateIso,
    datePrecision,
    extractedDateText: preferNext
      ? next.extractedDateText ?? prev.extractedDateText
      : prev.extractedDateText ?? next.extractedDateText,
    confirmationStatus:
      prev.confirmationStatus === 'confirmed' || next.confirmationStatus === 'confirmed'
        ? 'confirmed'
        : 'unconfirmed',
    confidenceScore: Math.max(prev.confidenceScore, next.confidenceScore),
    tvmaze: next.tvmaze ?? prev.tvmaze,
    matchedKeywords: Array.from(new Set([...prev.matchedKeywords, ...next.matchedKeywords])),
    rawHeadline: preferNext ? next.rawHeadline : prev.rawHeadline,
    sourceName: preferNext ? next.sourceName : prev.sourceName,
    sourceUrl: preferNext ? next.sourceUrl : prev.sourceUrl,
    availabilityStatus: 'upcoming',
  };

  merged.availabilityStatus = computeAvailabilityStatus(merged.parsedDateIso);
  return merged;
}

function preferDate(prev: UpcomingReleaseLead, next: UpcomingReleaseLead): string | null {
  // Prefer a confirmed TVmaze air date when present
  if (next.tvmaze?.nextEpisodeAirDate) return next.tvmaze.nextEpisodeAirDate;
  if (prev.tvmaze?.nextEpisodeAirDate) return prev.tvmaze.nextEpisodeAirDate;
  if (next.datePrecision === 'exact' && next.parsedDateIso) return next.parsedDateIso;
  if (prev.datePrecision === 'exact' && prev.parsedDateIso) return prev.parsedDateIso;
  return next.parsedDateIso ?? prev.parsedDateIso ?? null;
}
