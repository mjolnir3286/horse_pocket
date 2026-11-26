import type { UpcomingReleaseLead } from '../types/collector';

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function isoFromDate(d: Date): string {
  return toIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function seasonStart(season: string, now: Date): string {
  const month =
    season === 'spring' ? 3 : season === 'summer' ? 6 : season === 'winter' ? 12 : 9;
  let year = now.getFullYear();
  if (now.getMonth() + 1 > month + 2) year += 1;
  return toIso(year, month, 1);
}

/** Best-effort sort date for a vague news phrase like "January 2027" or "This Fall". */
export function estimateDateIso(text: string | null | undefined, now = new Date()): string | null {
  if (!text) return null;
  const t = text.toLowerCase().trim();
  if (/this week/.test(t)) return isoFromDate(now);
  const season = t.match(/this (spring|summer|fall|autumn|winter)/);
  if (season) return seasonStart(season[1] === 'autumn' ? 'fall' : season[1], now);
  if (/next season/.test(t)) {
    const d = new Date(now.getTime());
    d.setMonth(d.getMonth() + 4);
    return isoFromDate(d);
  }
  const monthName = Object.keys(MONTHS)
    .sort((a, b) => b.length - a.length)
    .find((name) => t.includes(name));
  if (!monthName) return null;
  const month = MONTHS[monthName];
  const yearMatch = t.match(/\b(20\d{2})\b/);
  let year = yearMatch ? Number(yearMatch[1]) : now.getFullYear();
  if (!yearMatch && month < now.getMonth() + 1) year += 1;
  const withoutYear = yearMatch ? t.replace(yearMatch[0], ' ') : t;
  const withoutMonth = withoutYear.replace(monthName, ' ');
  const dayMatch = withoutMonth.match(/\b([12]\d|3[01]|[1-9])\b/);
  const day = dayMatch ? Number(dayMatch[1]) : 1;
  return toIso(year, month, day);
}

/**
 * Sort key: an exact ISO date as-is, otherwise a best estimate from vague text, otherwise null (sorts last).
 * A vague estimate that is already in the past (a stale "September 2026", or a "This Week" article more
 * than 7 days old) is not clamped to today; it gets null so it sorts last instead of jumping ahead.
 */
export function leadSortDate(lead: UpcomingReleaseLead, now = new Date()): string | null {
  if (lead.parsedDateIso) return lead.parsedDateIso;
  const text = lead.extractedDateText;
  const estimate = estimateDateIso(text, now);
  if (!estimate) return null;
  if (estimate < isoFromDate(now)) return null;
  if (text && /this week/i.test(text)) {
    const published = Date.parse(lead.publishedAt);
    if (Number.isFinite(published) && now.getTime() - published > 7 * 24 * 60 * 60 * 1000) return null;
  }
  return estimate;
}

/** Date order for Upcoming; undated sort last either way, and confirmed cards win ties. */
export function compareLeadDates(
  a: UpcomingReleaseLead,
  b: UpcomingReleaseLead,
  latestFirst = false,
  now = new Date()
): number {
  const aDate = leadSortDate(a, now);
  const bDate = leadSortDate(b, now);
  if (!aDate && !bDate) return 0;
  if (!aDate) return 1;
  if (!bDate) return -1;
  const cmp = aDate.localeCompare(bDate);
  if (cmp !== 0) return latestFirst ? -cmp : cmp;
  const aConfirmed = a.confirmationStatus === 'confirmed' ? 0 : 1;
  const bConfirmed = b.confirmationStatus === 'confirmed' ? 0 : 1;
  return aConfirmed - bConfirmed;
}

export function formatExactDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export interface LeadDateDisplay {
  dateText: string | null;
  unconfirmed: boolean;
}

/** How the date spot on an Upcoming card should read. */
export function leadDateDisplay(lead: UpcomingReleaseLead): LeadDateDisplay {
  const confirmedExact =
    lead.confirmationStatus === 'confirmed' && lead.datePrecision === 'exact' && Boolean(lead.parsedDateIso);
  if (confirmedExact && lead.parsedDateIso) {
    return { dateText: formatExactDate(lead.parsedDateIso), unconfirmed: false };
  }
  if (lead.datePrecision === 'exact' && lead.parsedDateIso) {
    return { dateText: formatExactDate(lead.parsedDateIso), unconfirmed: true };
  }
  const rough = lead.extractedDateText?.trim();
  if (rough) return { dateText: rough, unconfirmed: true };
  return { dateText: null, unconfirmed: true };
}

export function episodeLine(lead: UpcomingReleaseLead): string | null {
  const tv = lead.tvmaze;
  if (tv?.nextEpisodeSeason == null || tv.nextEpisodeNumber == null) return null;
  const code = `S${tv.nextEpisodeSeason}E${tv.nextEpisodeNumber}`;
  const name = tv.nextEpisodeName?.trim();
  return name ? `${code} · ${name}` : code;
}
