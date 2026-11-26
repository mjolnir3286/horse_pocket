import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyWatchlistView,
  DEFAULT_WATCHLIST_VIEW,
  readWatchlistView,
  sanitizeWatchlistView,
  sortWatchlist,
  WATCHLIST_VIEW_STORAGE_KEY,
  writeWatchlistView,
  type WatchlistSortableItem,
} from './watchlistView.ts';

function item(
  partial: Partial<WatchlistSortableItem> & Pick<WatchlistSortableItem, 'key' | 'title'>
): WatchlistSortableItem {
  return {
    mediaType: partial.mediaType ?? 'tv',
    year: partial.year ?? null,
    releaseDate: partial.releaseDate ?? null,
    followedAt: partial.followedAt ?? null,
    lastStatus: partial.lastStatus,
    ...partial,
  };
}

test('recent sort puts newest followedAt first and untimestamped legacy items at bottom by title', () => {
  const list = [
    item({ key: 'tv-1', title: 'Zebra', followedAt: null }),
    item({ key: 'tv-2', title: 'Oldest Follow', followedAt: '2026-01-01T00:00:00.000Z' }),
    item({ key: 'tv-3', title: 'Alpha', followedAt: 'not-a-date' }),
    item({ key: 'movie-4', title: 'Newest Follow', mediaType: 'movie', followedAt: '2026-05-01T12:00:00.000Z' }),
    item({ key: 'tv-5', title: 'Tie A', followedAt: '2026-03-01T00:00:00.000Z' }),
    item({ key: 'tv-6', title: 'Tie B', followedAt: '2026-03-01T00:00:00.000Z' }),
  ];

  assert.deepEqual(
    sortWatchlist(list, 'recent').map((x) => x.key),
    ['movie-4', 'tv-5', 'tv-6', 'tv-2', 'tv-3', 'tv-1']
  );
});

test('title-az sort ignores case and sorts alphabetically', () => {
  const list = [
    item({ key: '1', title: 'zebra' }),
    item({ key: '2', title: 'Alpha' }),
    item({ key: '3', title: 'middle' }),
  ];

  assert.deepEqual(
    sortWatchlist(list, 'title-az').map((x) => x.key),
    ['2', '3', '1']
  );
});

test('release-newest and release-oldest use releaseDate, fall back to year, and put missing dates last', () => {
  const list = [
    item({ key: 'nodate-z', title: 'Zeta' }),
    item({ key: 'year-2024', title: 'Year Only 2024', year: '2024' }),
    item({ key: 'full-2024', title: 'Full 2024', year: '2024', releaseDate: '2024-06-15' }),
    item({ key: 'full-2022', title: 'Full 2022', year: '2022', releaseDate: '2022-03-01' }),
    item({ key: 'nodate-a', title: 'Alpha' }),
    item({ key: 'year-2026', title: 'Year 2026', year: '2026' }),
  ];

  assert.deepEqual(
    sortWatchlist(list, 'release-newest').map((x) => x.key),
    ['year-2026', 'full-2024', 'year-2024', 'full-2022', 'nodate-a', 'nodate-z']
  );

  assert.deepEqual(
    sortWatchlist(list, 'release-oldest').map((x) => x.key),
    ['full-2022', 'year-2024', 'full-2024', 'year-2026', 'nodate-a', 'nodate-z']
  );
});

test('upcoming sort puts non-past next episodes soonest first, then past/missing/movies by title', () => {
  const now = new Date(2026, 10, 25, 12, 0, 0); // 2026-11-25 local
  const list = [
    item({
      key: 'later',
      title: 'Later Show',
      lastStatus: { next: { airdate: '2026-12-02' } },
    }),
    item({
      key: 'past',
      title: 'Bravo Stale',
      lastStatus: { next: { airdate: '2026-11-20' } },
    }),
    item({
      key: 'movie',
      title: 'Alpha Movie',
      mediaType: 'movie',
      lastStatus: { next: { airdate: '2026-11-26' } },
    }),
    item({
      key: 'today',
      title: 'Today Show',
      lastStatus: { next: { airdate: '2026-11-25' } },
    }),
    item({
      key: 'none',
      title: 'Charlie No Date',
      lastStatus: { next: null },
    }),
  ];

  assert.deepEqual(
    sortWatchlist(list, 'upcoming', now).map((x) => x.key),
    ['today', 'later', 'movie', 'past', 'none']
  );
});

test('applyWatchlistView composes type filter and hide-watched after tracking typeFilteredCount', () => {
  const list = [
    item({ key: 'tv-1', mediaType: 'tv', title: 'Show A', followedAt: '2026-01-01T00:00:00.000Z' }),
    item({ key: 'tv-2', mediaType: 'tv', title: 'Show B', followedAt: '2026-02-01T00:00:00.000Z' }),
    item({ key: 'movie-1', mediaType: 'movie', title: 'Movie A', followedAt: '2026-03-01T00:00:00.000Z' }),
  ];

  const hidden = new Set(['tv-2']);
  const showsOnly = applyWatchlistView(list, { sort: 'title-az', typeFilter: 'tv' }, (x) => hidden.has(x.key));
  assert.equal(showsOnly.typeFilteredCount, 2);
  assert.deepEqual(showsOnly.items.map((x) => x.key), ['tv-1']);

  const allShowsHidden = applyWatchlistView(list, { sort: 'recent', typeFilter: 'tv' }, () => true);
  assert.equal(allShowsHidden.typeFilteredCount, 2);
  assert.deepEqual(allShowsHidden.items, []);
});

test('sanitizeWatchlistView and storage helpers fall back cleanly on invalid input', () => {
  assert.deepEqual(sanitizeWatchlistView(null), DEFAULT_WATCHLIST_VIEW);
  assert.deepEqual(sanitizeWatchlistView({ sort: 'bad', typeFilter: 'movie' }), {
    sort: 'recent',
    typeFilter: 'movie',
  });

  const data = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };

  assert.deepEqual(readWatchlistView(mockStorage), DEFAULT_WATCHLIST_VIEW);
  writeWatchlistView({ sort: 'upcoming', typeFilter: 'tv' }, mockStorage);
  assert.equal(data.has(WATCHLIST_VIEW_STORAGE_KEY), true);
  assert.deepEqual(readWatchlistView(mockStorage), { sort: 'upcoming', typeFilter: 'tv' });

  data.set(WATCHLIST_VIEW_STORAGE_KEY, '{not json');
  assert.deepEqual(readWatchlistView(mockStorage), DEFAULT_WATCHLIST_VIEW);
});
