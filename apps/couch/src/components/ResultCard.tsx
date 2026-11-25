import React from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { posterUrl, type TmdbTitle, type WatchOptions } from '../services/tmdb';
import { WatchOptionsSummary } from './WatchOptions';

interface ResultCardProps {
  item: TmdbTitle;
  options: WatchOptions | null | undefined;
  isFollowed: boolean;
  onToggleFollow: (item: TmdbTitle) => void;
  onSelect: (item: TmdbTitle) => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({ item, options, isFollowed, onToggleFollow, onSelect }) => {
  const poster = posterUrl(item.posterPath);
  const typeLabel = item.mediaType === 'tv' ? 'Show' : 'Movie';
  return (
    <div
      className="title-card"
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item);
        }
      }}
    >
      <div className="poster-tile">
        {poster ? (
          <img src={poster} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span>{item.title.slice(0, 2).toUpperCase()}</span>
        )}
        <span className="poster-type-tag">{typeLabel}</span>
      </div>
      <div className="title-body">
        <div className="title-top">
          <h3 className="title-name">{item.title}</h3>
          <button
            type="button"
            className={`follow-icon-btn ${isFollowed ? 'following' : ''}`}
            aria-label={isFollowed ? `Unfollow ${item.title}` : `Follow ${item.title}`}
            title={isFollowed ? 'In your Watchlist' : item.mediaType === 'tv' ? 'Follow for episode alerts' : 'Save to Watchlist'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFollow(item);
            }}
          >
            {isFollowed ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
          </button>
        </div>
        <div className="title-meta">
          <span>{typeLabel}</span>
          {item.year && (
            <>
              <span>•</span>
              <span>{item.year}</span>
            </>
          )}
        </div>
        {options ? (
          <WatchOptionsSummary options={options} />
        ) : (
          <div className="watch-summary muted">Tap for where to watch</div>
        )}
      </div>
    </div>
  );
};
