import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCouchBackup } from './backup.ts';
import { sanitizeWatched } from './watched.ts';
import { safeHttpUrl } from '../lib/safeUrl.ts';

function backup(follows: unknown[], watched: unknown = {}) {
  return JSON.stringify({
    app: 'couch',
    version: 1,
    exportedAt: '2026-11-25T00:00:00.000Z',
    watchlist: { follows, followedLeadNames: [], alerts: [], lastCheckedAt: null },
    watched,
    settings: { welcomeDismissed: true, discoverTypeFilter: 'all', hideWatched: false, myServices: [] },
    filters: { watchlistOnly: false, upcomingPlatforms: [], upcomingSort: 'date-soonest' },
  });
}

const follow = (extra: Record<string, unknown> = {}) => ({
  key: 'tv-1',
  mediaType: 'tv',
  tmdbId: 1,
  tvmazeId: 2,
  title: 'Show',
  year: '2020',
  posterPath: null,
  followedAt: '2026-01-01T00:00:00.000Z',
  lastNotifiedEpisodeId: null,
  lastNotifiedAirstamp: null,
  ...extra,
});

test('safeHttpUrl allows only http(s)', () => {
  assert.equal(safeHttpUrl('https://www.tvmaze.com/shows/1'), 'https://www.tvmaze.com/shows/1');
  assert.equal(safeHttpUrl('javascript:alert(1)'), null);
  assert.equal(safeHttpUrl('data:text/html,hi'), null);
  assert.equal(safeHttpUrl('/relative'), null);
  assert.equal(safeHttpUrl(42), null);
});

test('import drops a lastStatus with a javascript: link and unknown fields', () => {
  const res = parseCouchBackup(
    backup([follow({ evil: 'x', lastStatus: { checkedAt: 'now', network: null, showStatus: 'Running', tvmazeUrl: 'javascript:alert(1)', previous: null, next: null } })])
  );
  assert.ok(res.ok);
  if (!res.ok) return;
  const f = res.backup.watchlist.follows[0];
  assert.equal(f.lastStatus, undefined);
  assert.equal((f as unknown as Record<string, unknown>).evil, undefined);
});

test('import keeps a valid https lastStatus', () => {
  const res = parseCouchBackup(
    backup([follow({ lastStatus: { checkedAt: 'now', network: 'HBO', showStatus: 'Running', tvmazeUrl: 'https://www.tvmaze.com/shows/2', previous: null, next: null } })])
  );
  assert.ok(res.ok);
  if (res.ok) assert.equal(res.backup.watchlist.follows[0].lastStatus?.tvmazeUrl, 'https://www.tvmaze.com/shows/2');
});

test('sanitizeWatched rejects __proto__, constructor, prototype keys', () => {
  const raw = JSON.parse(
    '{"__proto__":{"mediaType":"tv","title":"x","polluted":true},"constructor":{"mediaType":"tv","title":"y"},"prototype":{"mediaType":"tv","title":"z"},"tv-1":{"mediaType":"tv","title":"ok"}}'
  );
  const out = sanitizeWatched(raw);
  assert.deepEqual(Object.keys(out), ['tv-1']);
  assert.equal(Object.getPrototypeOf(out), Object.prototype);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.equal((out as unknown as Record<string, unknown>).polluted, undefined);
});

test('import rejects a follow keyed __proto__', () => {
  assert.equal(parseCouchBackup(backup([follow({ key: '__proto__' })])).ok, false);
});

test('import defaults watchlistSort and watchlistType for older backups without them', () => {
  const res = parseCouchBackup(backup([follow()]));
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(res.backup.filters.watchlistSort, 'recent');
  assert.equal(res.backup.filters.watchlistType, 'all');
  assert.equal(res.backup.watchlist.follows[0].releaseDate, undefined);
});

test('import keeps valid watchlistSort, watchlistType, and ISO releaseDate, and drops invalid ones', () => {
  const raw = JSON.stringify({
    app: 'couch',
    version: 1,
    exportedAt: '2026-11-25T00:00:00.000Z',
    watchlist: {
      follows: [
        follow({ key: 'tv-1', releaseDate: '2024-05-12' }),
        follow({ key: 'tv-2', releaseDate: 'javascript:alert(1)' }),
        follow({ key: 'tv-3', releaseDate: '2024' }),
      ],
      followedLeadNames: [],
      alerts: [],
      lastCheckedAt: null,
    },
    watched: {},
    settings: { welcomeDismissed: true, discoverTypeFilter: 'all', hideWatched: false, myServices: [] },
    filters: {
      watchlistOnly: false,
      upcomingPlatforms: [],
      upcomingSort: 'date-soonest',
      watchlistSort: 'release-newest',
      watchlistType: 'movie',
    },
  });

  const res = parseCouchBackup(raw);
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(res.backup.filters.watchlistSort, 'release-newest');
  assert.equal(res.backup.filters.watchlistType, 'movie');
  assert.equal(res.backup.watchlist.follows[0].releaseDate, '2024-05-12');
  assert.equal(res.backup.watchlist.follows[1].releaseDate, undefined);
  assert.equal(res.backup.watchlist.follows[2].releaseDate, undefined);
});

test('import falls back when watchlistSort or watchlistType is unknown', () => {
  const raw = JSON.stringify({
    app: 'couch',
    version: 1,
    exportedAt: '2026-11-25T00:00:00.000Z',
    watchlist: { follows: [follow()], followedLeadNames: [], alerts: [], lastCheckedAt: null },
    watched: {},
    settings: { welcomeDismissed: true, discoverTypeFilter: 'all', hideWatched: false, myServices: [] },
    filters: {
      watchlistOnly: false,
      upcomingPlatforms: [],
      upcomingSort: 'date-soonest',
      watchlistSort: 'bogus',
      watchlistType: 'books',
    },
  });

  const res = parseCouchBackup(raw);
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(res.backup.filters.watchlistSort, 'recent');
  assert.equal(res.backup.filters.watchlistType, 'all');
});
