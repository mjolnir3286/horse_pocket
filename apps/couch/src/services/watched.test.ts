import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isTitleWatched, type EpisodeRef, type WatchedEntry } from './watched.ts';

function entry(partial: Partial<WatchedEntry> & Pick<WatchedEntry, 'mediaType' | 'title'>): WatchedEntry {
  return {
    key: partial.key ?? 'tv-1',
    mediaType: partial.mediaType,
    tmdbId: partial.tmdbId ?? 1,
    tvmazeId: partial.tvmazeId ?? 1,
    title: partial.title,
    year: partial.year ?? '2020',
    posterPath: null,
    allAiredAt: partial.allAiredAt ?? null,
    episodes: partial.episodes ?? {},
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function ep(id: number, airdate: string | null, airstamp: string | null = null): EpisodeRef {
  return { id, airdate, airstamp };
}

test('movie with a whole-title mark is caught up', () => {
  const movie = entry({ mediaType: 'movie', title: 'Test Movie', allAiredAt: '2026-01-10T00:00:00.000Z', key: 'movie-1' });
  assert.equal(isTitleWatched(movie), true);
});

test('movie without a mark is not caught up', () => {
  assert.equal(isTitleWatched(entry({ mediaType: 'movie', title: 'Test Movie', key: 'movie-1' })), false);
  assert.equal(isTitleWatched(undefined), false);
});

test('show with a whole-show mark and no episode list is caught up', () => {
  const show = entry({ mediaType: 'tv', title: 'Caught Up Show', allAiredAt: '2026-06-01T00:00:00.000Z' });
  assert.equal(isTitleWatched(show), true);
});

test('new aired episode after the whole-show mark keeps the show unwatched', () => {
  const show = entry({ mediaType: 'tv', title: 'New Episode Show', allAiredAt: '2026-01-01T00:00:00.000Z' });
  const episodes = [
    ep(1, '2025-12-01', '2025-12-01T20:00:00.000Z'),
    ep(2, '2026-03-01', '2026-03-01T20:00:00.000Z'),
  ];
  assert.equal(isTitleWatched(show, episodes), false);
});

test('unaired episodes do not keep a marked show from being caught up', () => {
  const show = entry({ mediaType: 'tv', title: 'Caught Up Show', allAiredAt: '2026-06-01T00:00:00.000Z' });
  const episodes = [
    ep(1, '2026-05-01', '2026-05-01T20:00:00.000Z'),
    ep(2, '2099-01-01', '2099-01-01T20:00:00.000Z'),
  ];
  assert.equal(isTitleWatched(show, episodes), true);
});

test('per-episode ticks hide a show only when every aired episode is ticked', () => {
  const show = entry({ mediaType: 'tv', title: 'Partial Ticks Show', episodes: { '1': true, '2': true } });
  const allAired = [ep(1, '2026-01-01', '2026-01-01T20:00:00.000Z'), ep(2, '2026-01-08', '2026-01-08T20:00:00.000Z')];
  const missingOne = [...allAired, ep(3, '2026-01-15', '2026-01-15T20:00:00.000Z')];
  const withUnaired = [...allAired, ep(4, '2099-01-01', '2099-01-01T20:00:00.000Z')];
  assert.equal(isTitleWatched(show, allAired), true);
  assert.equal(isTitleWatched(show, missingOne), false);
  assert.equal(isTitleWatched(show, withUnaired), true);
  // Without a list, ticks alone are not enough.
  assert.equal(isTitleWatched(show), false);
});

test('an explicit unwatch override prevents a whole-show mark from counting as caught up', () => {
  const show = entry({
    mediaType: 'tv',
    title: 'Partial Ticks Show',
    allAiredAt: '2026-06-01T00:00:00.000Z',
    episodes: { '2': false },
  });
  const episodes = [
    ep(1, '2026-05-01', '2026-05-01T20:00:00.000Z'),
    ep(2, '2026-05-08', '2026-05-08T20:00:00.000Z'),
  ];
  assert.equal(isTitleWatched(show, episodes), false);
  assert.equal(isTitleWatched(show), false);
});
