import React from 'react';
import { Bookmark, BookmarkCheck, Sparkles, Star } from 'lucide-react';
import type { MediaTitle, PlatformId, StreamingPlatform } from '../types/streaming';

interface TitleCardProps {
  item: MediaTitle;
  platformsById: Record<PlatformId, StreamingPlatform>;
  isFollowed: boolean;
  onToggleFollow: (id: string) => void;
  onSelect: (item: MediaTitle) => void;
}

export const TitleCard: React.FC<TitleCardProps> = ({
  item,
  platformsById,
  isFollowed,
  onToggleFollow,
  onSelect,
}) => {
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
      <div
        className="poster-tile"
        style={{
          background: `linear-gradient(155deg, ${item.posterGradient[0]}, ${item.posterGradient[1]})`,
        }}
      >
        {item.posterUrl ? (
          <img
            src={item.posterUrl}
            alt={item.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span>{item.posterInitials}</span>
        )}
        <span className="poster-type-tag">{item.type}</span>
      </div>

      <div className="title-body">
        <div className="title-top">
          <h3 className="title-name">{item.title}</h3>
          <button
            type="button"
            className={`follow-icon-btn ${isFollowed ? 'following' : ''}`}
            aria-label={isFollowed ? `Unfollow ${item.title}` : `Follow ${item.title}`}
            title={isFollowed ? 'In Watchlist (Episode Alerts On)' : 'Add to Watchlist'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFollow(item.id);
            }}
          >
            {isFollowed ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
          </button>
        </div>

        <div className="title-meta">
          <span>{item.releaseYear}</span>
          <span>•</span>
          <span>{item.rating}</span>
          <span>•</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Star size={12} fill="#f59e0b" color="#f59e0b" />
            {item.score.toFixed(1)}
          </span>
          <span>•</span>
          <span>{item.genres.slice(0, 2).join(', ')}</span>
        </div>

        {item.latestEpisode && (
          <div className="episode-pill">
            {item.latestEpisode.isNew && <Sparkles size={11} />}
            <span>
              S{item.latestEpisode.season}E{item.latestEpisode.episode} • {item.latestEpisode.airDate}
            </span>
          </div>
        )}

        <div className="platform-pills">
          {item.availability.length === 0 ? (
            <span className="access-tag">No US streaming match found</span>
          ) : (
            item.availability.map((avail) => {
              const p = platformsById[avail.platformId];
              if (!p) return null;
              return (
                <span key={`${item.id}-${avail.platformId}`} className="platform-pill">
                  <span className="platform-dot" style={{ backgroundColor: p.brandColor }} />
                  <span>{p.name}</span>
                  {avail.accessType !== 'subscription' && (
                    <span className="access-tag">({avail.accessType})</span>
                  )}
                </span>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
