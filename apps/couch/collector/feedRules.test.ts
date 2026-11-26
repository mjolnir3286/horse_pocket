import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  extractQuotedTitles,
  isEnglishOrMissing,
  isMatchedLead,
  pruneStaleLeads,
  splitMultiTitle,
  tightNameMatch,
} from './titleUtils.ts';
import { episodeToLead } from './tvmazeClient.ts';

const now = new Date('2026-11-25T12:00:00Z');

function episode(language: string | null | undefined, id = 1) {
  return {
    id,
    name: 'Pilot',
    season: 1,
    number: 1,
    airdate: '2026-11-26',
    _embedded: { show: { id: 10 + id, name: 'Some Show', language, webChannel: { name: 'Netflix' } } },
  };
}

test('#29 schedule leads keep English or missing language and drop others', () => {
  assert.ok(episodeToLead(episode('English'), now, now.toISOString()));
  assert.ok(episodeToLead(episode(null, 2), now, now.toISOString()));
  assert.ok(episodeToLead(episode(undefined, 3), now, now.toISOString()));
  assert.equal(episodeToLead(episode('Portuguese', 4), now, now.toISOString()), null);
  assert.equal(episodeToLead(episode('Japanese', 5), now, now.toISOString()), null);
  assert.equal(isEnglishOrMissing(' english '), true);
});

test('#30 tight name match rejects substring matches', () => {
  assert.equal(tightNameMatch('The Empress', 'Empress'), true); // leading "The" is ignored
  assert.equal(tightNameMatch('Ghosts', 'Ghosts (US)'), true);
  assert.equal(tightNameMatch('The Empress', 'The Empress of Pyongyang'), false);
  assert.equal(tightNameMatch('Mo', 'Moonshine'), false);
  assert.equal(tightNameMatch('', ''), false);
});

test('#30 multi-title headlines split into pieces', () => {
  assert.deepEqual(splitMultiTitle('Stick and Being Huemann'), ['Stick', 'Being Huemann']);
  assert.deepEqual(splitMultiTitle('A, B & C'), []); // pieces too short to be titles
  assert.deepEqual(splitMultiTitle('Stick, Foundation & Silo'), ['Stick', 'Foundation', 'Silo']);
  assert.deepEqual(splitMultiTitle('Severance'), []);
  assert.deepEqual(
    extractQuotedTitles('Coming to Apple TV in November: A New Season of ‘Stick,’ ‘Being Heumann’ and More'),
    ['Stick', 'Being Heumann']
  );
  assert.deepEqual(extractQuotedTitles("Netflix's 'The Empress' Season 3 Release Date"), ['The Empress']);
});

test('#30 unmatched leads are not matched; schedule and TVmaze leads are', () => {
  assert.equal(isMatchedLead({ sourceName: 'Deadline' }), false);
  assert.equal(isMatchedLead({ sourceName: 'Deadline', tvmaze: { showId: 1 } }), true);
  assert.equal(isMatchedLead({ sourceName: 'TVmaze web schedule' }), true);
});

test('#30 undated leads expire 14 days after the last mention; dated ones 14 days after release', () => {
  const leads = [
    { id: 'undated-old', availabilityStatus: 'upcoming', parsedDateIso: null, lastSeenAt: '2026-11-10T00:00:00Z', sourceName: 'Deadline' },
    { id: 'undated-edge', availabilityStatus: 'upcoming', parsedDateIso: null, lastSeenAt: '2026-11-11T00:00:00Z', sourceName: 'Deadline' },
    { id: 'undated-new', availabilityStatus: 'upcoming', parsedDateIso: null, lastSeenAt: '2026-11-24T00:00:00Z', sourceName: 'Deadline' },
    { id: 'future-old-mention', availabilityStatus: 'upcoming', parsedDateIso: '2027-01-10', lastSeenAt: '2026-10-01T00:00:00Z', sourceName: 'Deadline' },
    { id: 'released-old', availabilityStatus: 'available-now', parsedDateIso: '2026-11-10', lastSeenAt: '2026-11-24T00:00:00Z', sourceName: 'Deadline' },
  ];
  assert.deepEqual(
    pruneStaleLeads(leads, now).map((l) => l.id),
    ['undated-edge', 'undated-new', 'future-old-mention']
  );
});

test('#30 a failed or empty source keeps its last good items', () => {
  const leads = [
    { id: 'a', availabilityStatus: 'upcoming', parsedDateIso: null, lastSeenAt: '2026-10-01T00:00:00Z', sourceName: 'Deadline' },
    { id: 'b', availabilityStatus: 'upcoming', parsedDateIso: null, lastSeenAt: '2026-10-01T00:00:00Z', sourceName: 'Variety TV' },
  ];
  assert.deepEqual(
    pruneStaleLeads(leads, now, 14, new Set(['Deadline'])).map((l) => l.id),
    ['a']
  );
});
