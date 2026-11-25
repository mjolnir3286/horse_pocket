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

/**
 * Drop "available now" leads whose date is more than `keepDays` days ago, so the data file
 * doesn't grow forever. Upcoming leads are always kept.
 */
export function pruneStaleLeads<T extends { availabilityStatus: string; parsedDateIso: string | null }>(
  leads: T[],
  now = new Date(),
  keepDays = AVAILABLE_NOW_KEEP_DAYS
): T[] {
  const cutoff = todayIso(new Date(now.getTime() - keepDays * 24 * 60 * 60 * 1000));
  return leads.filter((l) => !(l.availabilityStatus === 'available-now' && l.parsedDateIso && l.parsedDateIso.slice(0, 10) < cutoff));
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
