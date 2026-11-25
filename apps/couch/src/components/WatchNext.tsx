import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { getRecommendations, peekRecommendations, type TmdbTitle } from '../services/tmdb';
import { PosterCard } from './PosterCard';
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

  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<Array<TmdbTitle[] | undefined> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Stay collapsed; if already loaded this session, keep the results for the next expand.
    if (!open) return;
    if (allCached) setLists(cachedLists);
  }, [allCached, cachedLists, open]);

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

  const expand = () => {
    setOpen(true);
    if (lists || loading) return;
    if (allCached) {
      setLists(cachedLists);
      return;
    }
    void load();
  };

  const canCollapse = usable.length > 0;
  const showBody = !canCollapse || open;

  return (
    <section className="watch-next" aria-labelledby="watch-next-heading">
      {canCollapse ? (
        <button type="button" className="watch-next-toggle" aria-expanded={open} onClick={() => (open ? setOpen(false) : expand())}>
          <h2 id="watch-next-heading">
            <Sparkles size={15} aria-hidden="true" /> Watch Next
          </h2>
          <ChevronDown size={16} className={`episodes-chevron ${open ? 'open' : ''}`} aria-hidden="true" />
        </button>
      ) : (
        <div className="section-heading">
          <h2 id="watch-next-heading">
            <Sparkles size={15} aria-hidden="true" /> Watch Next
          </h2>
        </div>
      )}

      {sources.length === 0 ? (
        <div className="panel empty-panel watch-next-empty">Mark a few titles watched to get suggestions.</div>
      ) : usable.length === 0 ? (
        <div className="panel empty-panel watch-next-empty">
          Suggestions need a title from Discover. Mark something you found in Discover as watched.
        </div>
      ) : !showBody ? (
        null
      ) : !lists && loading ? (
        <div className="panel watch-next-load">
          <span className="muted small">Loading suggestions…</span>
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
          {suggestions.map(({ title: t, because }) => (
            <PosterCard
              key={`${t.mediaType}-${t.id}`}
              title={t}
              followed={isFollowed(t)}
              onSelect={onSelect}
              onToggleFollow={onToggleFollow}
              note={`Similar to ${because}`}
            />
          ))}
        </div>
      )}
    </section>
  );
};
