import React, { useEffect, useId, useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { getRecommendations, peekRecommendations, type TmdbMediaType, type TmdbTitle } from '../services/tmdb';
import { PosterCard } from './PosterCard';

interface MoreLikeThisProps {
  mediaType: TmdbMediaType;
  id: number;
  title: string;
  isHidden: (t: TmdbTitle) => boolean;
  isFollowed: (t: TmdbTitle) => boolean;
  isWatched: (t: TmdbTitle) => boolean;
  onToggleFollow: (t: TmdbTitle) => void;
  onToggleWatched: (t: TmdbTitle) => void;
  onSelect: (t: TmdbTitle) => void;
}

/** TMDB recommendations for one title, loaded only when the user opens it (cached 24 hours). */
export const MoreLikeThis: React.FC<MoreLikeThisProps> = ({ mediaType, id, title, isHidden, isFollowed, isWatched, onToggleFollow, onToggleWatched, onSelect }) => {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [titles, setTitles] = useState<TmdbTitle[] | null | undefined>(undefined);

  useEffect(() => {
    setOpen(false);
    setTitles(undefined);
  }, [mediaType, id]);

  const load = () => {
    const cached = peekRecommendations(mediaType, id);
    if (cached) return setTitles(cached);
    setTitles(undefined);
    getRecommendations(mediaType, id)
      .then(setTitles)
      .catch(() => setTitles(null));
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && titles == null) load();
  };

  const visible = titles ? titles.filter((t) => !isHidden(t)) : [];

  return (
    <section className="more-like-this">
      <button type="button" className="watch-next-toggle more-like-toggle" aria-expanded={open} aria-controls={panelId} onClick={toggle}>
        <span className="detail-section-label">
          <Sparkles size={13} aria-hidden="true" /> More like this
        </span>
        <ChevronDown size={16} className={`episodes-chevron ${open ? 'open' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId}>
          {titles === undefined ? (
            <p className="muted small">Loading similar titles…</p>
          ) : titles === null ? (
            <p className="muted small">
              Similar titles are unavailable right now.{' '}
              <button type="button" className="text-btn" onClick={load}>
                Try again
              </button>
            </p>
          ) : visible.length === 0 ? (
            <p className="muted small">
              {titles.length > 0 ? 'Everything similar is marked watched.' : `No similar titles found for ${title}.`}
            </p>
          ) : (
            <div className="title-row" role="list" aria-label={`More like ${title}`}>
              {visible.map((t) => (
                <PosterCard key={`${t.mediaType}-${t.id}`} title={t} followed={isFollowed(t)} watched={isWatched(t)} onSelect={onSelect} onToggleFollow={onToggleFollow} onToggleWatched={onToggleWatched} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
