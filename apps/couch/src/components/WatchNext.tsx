import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, Sparkles } from 'lucide-react';
import { getRecommendations, peekRecommendations, posterUrl, type TmdbTitle } from '../services/tmdb';
import type { WatchedEntry } from '../services/watched';

interface WatchNextProps {
  /** Titles marked watched (newest first). Only these drive suggestions. */
  sources: WatchedEntry[];
  isWatched: (t: TmdbTitle) => boolean;
  isFollowed: (t: TmdbTitle) => boolean;
  onToggleFollow: (t: TmdbTitle) => void;
  onSelect: (t: TmdbTitle) => void;
}

const MAX_SOURCES = 6;
const MAX_SUGGESTIONS = 10;

interface Suggestion {
  title: TmdbTitle;
  score: number;
  because: string;
}

function rank(sources: WatchedEntry[], lists: Array<TmdbTitle[] | undefined>, isWatched: (t: TmdbTitle) => boolean): Suggestion[] {
  const byKey = new Map<string, Suggestion>();
  lists.forEach((list, i) => {
    if (!list) return;
    list.forEach((t, rankIdx) => {
      if (isWatched(t)) return;
      const key = `${t.mediaType}-${t.id}`;
      const weight = (list.length - rankIdx) / list.length + (sources.length - i) * 0.05;
      const existing = byKey.get(key);
      if (existing) existing.score += weight + 1;
      else byKey.set(key, { title: t, score: weight, because: sources[i].title });
    });
  });
  return [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, MAX_SUGGESTIONS);
}

/** Suggestions from TMDB recommendations for watched titles only. Loads on tap, or instantly from a 24h cache. */
export const WatchNext: React.FC<WatchNextProps> = ({ sources, isWatched, isFollowed, onToggleFollow, onSelect }) => {
  const usable = useMemo(() => sources.filter((s) => s.tmdbId != null).slice(0, MAX_SOURCES), [sources]);
  const cachedLists = useMemo(() => usable.map((s) => peekRecommendations(s.mediaType, s.tmdbId as number)), [usable]);
  const allCached = usable.length > 0 && cachedLists.every(Boolean);

  const [lists, setLists] = useState<Array<TmdbTitle[] | undefined> | null>(allCached ? cachedLists : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLists(allCached ? cachedLists : null);
  }, [allCached, cachedLists]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    const results = await Promise.all(
      usable.map((s) => getRecommendations(s.mediaType, s.tmdbId as number).catch(() => undefined))
    );
    if (results.every((r) => r === undefined)) setError(true);
    setLists(results);
    setLoading(false);
  }, [usable]);

  const suggestions = useMemo(() => (lists ? rank(usable, lists, isWatched) : []), [lists, usable, isWatched]);

  return (
    <section className="watch-next" aria-labelledby="watch-next-heading">
      <div className="section-heading">
        <h2 id="watch-next-heading">
          <Sparkles size={15} aria-hidden="true" /> Watch Next
        </h2>
        {usable.length > 0 && <span className="section-meta">Based on {usable.length} watched</span>}
      </div>

      {sources.length === 0 ? (
        <div className="panel empty-panel watch-next-empty">Mark a few titles watched to get suggestions.</div>
      ) : usable.length === 0 ? (
        <div className="panel empty-panel watch-next-empty">
          Suggestions need a title from Discover. Mark something you found in Discover as watched.
        </div>
      ) : !lists ? (
        <div className="panel watch-next-load">
          <span className="muted small">Suggestions from what you’ve watched, refreshed daily.</span>
          <button type="button" className="secondary-btn" onClick={() => void load()} disabled={loading}>
            <Sparkles size={14} aria-hidden="true" /> {loading ? 'Loading…' : 'Show suggestions'}
          </button>
        </div>
      ) : error ? (
        <div className="panel empty-panel">
          Suggestions are unavailable right now.{' '}
          <button type="button" className="text-btn" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="panel empty-panel">No new suggestions right now. Check back after marking more titles.</div>
      ) : (
        <div className="watch-next-row" role="list">
          {suggestions.map(({ title: t, because }) => {
            const poster = posterUrl(t.posterPath, 'w185');
            const followed = isFollowed(t);
            return (
              <div key={`${t.mediaType}-${t.id}`} className="watch-next-card" role="listitem">
                <button type="button" className="watch-next-poster" onClick={() => onSelect(t)} aria-label={`${t.title}, details`}>
                  {poster ? <img src={poster} alt="" loading="lazy" /> : <span>{t.title.slice(0, 2).toUpperCase()}</span>}
                </button>
                <div className="watch-next-meta">
                  <span className="watch-next-title" title={t.title}>
                    {t.title}
                  </span>
                  <span className="muted tiny">
                    {t.mediaType === 'tv' ? 'Show' : 'Movie'}
                    {t.year ? ` • ${t.year}` : ''}
                  </span>
                  <span className="muted tiny watch-next-because" title={`Because you watched ${because}`}>
                    Because you watched {because}
                  </span>
                </div>
                <button
                  type="button"
                  className={`follow-icon-btn watch-next-follow ${followed ? 'following' : ''}`}
                  aria-label={followed ? `Remove ${t.title} from Watchlist` : `Add ${t.title} to Watchlist`}
                  title={followed ? 'Watchlisted' : 'Add to Watchlist'}
                  onClick={() => onToggleFollow(t)}
                >
                  {followed ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
