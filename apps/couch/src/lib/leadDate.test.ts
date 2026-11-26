import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { UpcomingReleaseLead } from '../types/collector.ts';
import { compareLeadDates, leadSortDate } from './leadDate.ts';

const now = new Date('2026-11-25T12:00:00');

function lead(over: Partial<UpcomingReleaseLead>): UpcomingReleaseLead {
  return {
    id: 'x',
    showTitle: 'X',
    platformId: 'netflix',
    platformName: 'Netflix',
    rawHeadline: '',
    sourceName: 'Deadline',
    sourceUrl: '',
    publishedAt: '2026-11-24T00:00:00Z',
    firstSeenAt: '2026-11-24T00:00:00Z',
    lastSeenAt: '2026-11-24T00:00:00Z',
    extractedDateText: null,
    parsedDateIso: null,
    datePrecision: 'none',
    confirmationStatus: 'unconfirmed',
    availabilityStatus: 'upcoming',
    confidenceScore: 0.5,
    matchedKeywords: [],
    ...over,
  };
}

test('stale vague dates are not clamped to today and sort last', () => {
  const stale = lead({ extractedDateText: 'September 2026', datePrecision: 'vague' });
  const confirmed = lead({ parsedDateIso: '2026-11-26', datePrecision: 'exact', confirmationStatus: 'confirmed' });
  assert.equal(leadSortDate(stale, now), null);
  assert.ok(compareLeadDates(confirmed, stale, false, now) < 0);
  assert.ok(compareLeadDates(confirmed, stale, true, now) < 0);
});

test('an old "This Week" card does not sort ahead of a confirmed later title', () => {
  const oldWeek = lead({ extractedDateText: 'this week', datePrecision: 'vague', publishedAt: '2026-11-10T00:00:00Z' });
  assert.equal(leadSortDate(oldWeek, now), null);
});

test('future vague dates still sort by estimate; confirmed wins a same-day tie', () => {
  const jan = lead({ extractedDateText: 'January 2027', datePrecision: 'vague' });
  assert.equal(leadSortDate(jan, now), '2027-01-01');
  const a = lead({ parsedDateIso: '2026-11-30', datePrecision: 'exact' });
  const b = lead({ parsedDateIso: '2026-11-30', datePrecision: 'exact', confirmationStatus: 'confirmed' });
  assert.ok(compareLeadDates(b, a, false, now) < 0);
});
