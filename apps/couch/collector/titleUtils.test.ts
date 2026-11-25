import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pruneStaleLeads } from './titleUtils.ts';

test('pruneStaleLeads drops available-now leads older than 14 days and keeps the rest', () => {
  const now = new Date('2026-11-25T12:00:00Z');
  const leads = [
    { id: 'old', availabilityStatus: 'available-now', parsedDateIso: '2026-11-10' },
    { id: 'edge', availabilityStatus: 'available-now', parsedDateIso: '2026-11-11' },
    { id: 'recent', availabilityStatus: 'available-now', parsedDateIso: '2026-11-20' },
    { id: 'upcoming-past', availabilityStatus: 'upcoming', parsedDateIso: '2026-01-01' },
    { id: 'nodate', availabilityStatus: 'upcoming', parsedDateIso: null },
  ];
  assert.deepEqual(pruneStaleLeads(leads, now).map((l) => l.id), ['edge', 'recent', 'upcoming-past', 'nodate']);
});
