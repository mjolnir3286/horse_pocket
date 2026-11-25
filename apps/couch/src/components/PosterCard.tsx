import React from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { posterUrl, type TmdbTitle } from '../services/tmdb';
import { WatchedButton } from './WatchedButton';

interface PosterCardProps {
  title: TmdbTitle;
  followed: boolean;
  watched: boolean;
  onSelect: (t: TmdbTitle) => void;
  onToggleFollow: (t: TmdbTitle) => void;
  onToggleWatched: (t: TmdbTitle) => void;
  /** Optional second muted line, e.g. "Similar to The Bear". Reserves two lines either way. */
  note?: string;
}

/** Poster card used by Watch Next, the Discover rows, and More like this. */
export const PosterCard: React.FC<PosterCardProps> = ({ title: t, followed, watched, onSelect, onToggleFollow, onToggleWatched, note }) => {
  const poster = posterUrl(t.posterPath, 'w185');
  return (
    <div className={`watch-next-card ${watched ? 'is-watched' : ''}`} role="listitem">
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
        {note !== undefined && (
          <span className="muted tiny watch-next-because" title={note}>
            {note}
          </span>
        )}
      </div>
      <WatchedButton className="watch-next-watched" watched={watched} title={t.title} onToggle={() => onToggleWatched(t)} />
      <button
        type="button"
        className={`follow-icon-btn watch-next-follow ${followed ? 'following' : ''}`}
        aria-label={followed ? `Remove ${t.title} from Watchlist` : `Add ${t.title} to Watchlist`}
        title={followed ? 'Watchlisted' : 'Add to Watchlist'}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFollow(t);
        }}
      >
        {followed ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
      </button>
    </div>
  );
};
