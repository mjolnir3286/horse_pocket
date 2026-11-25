import React, { useEffect, useState } from 'react';
import { BellRing, Bookmark, Check, ExternalLink, X } from 'lucide-react';
import { getWatchOptions, posterUrl, type TmdbTitle, type WatchOptions } from '../services/tmdb';
import type { FollowedTitle } from '../services/follows';
import { WatchOptionsFull } from './WatchOptions';

interface TitleDetailModalProps {
  item: TmdbTitle | null;
  follow: FollowedTitle | undefined;
  onToggleFollow: (item: TmdbTitle) => void;
  onClose: () => void;
  onOptionsLoaded?: (item: TmdbTitle, options: WatchOptions) => void;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'TBA';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export const TitleDetailModal: React.FC<TitleDetailModalProps> = ({ item, follow, onToggleFollow, onClose, onOptionsLoaded }) => {
  const [options, setOptions] = useState<WatchOptions | null | undefined>(undefined);

  useEffect(() => {
    if (!item) return;
    const ctrl = new AbortController();
    setOptions(undefined);
    getWatchOptions(item.mediaType, item.id, ctrl.signal)
      .then((o) => {
        setOptions(o);
        onOptionsLoaded?.(item, o);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setOptions(null);
      });
    return () => ctrl.abort();
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  if (!item) return null;
  const poster = posterUrl(item.posterPath, 'w342');
  const isFollowed = Boolean(follow);
  const status = follow?.lastStatus;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-sheet" role="dialog" aria-modal="true" aria-label={item.title} onClick={(e) => e.stopPropagation()}>
        <div className="detail-head">
          <div className="detail-identity">
            <div className="poster-tile detail-poster">
              {poster ? <img src={poster} alt="" /> : <span>{item.title.slice(0, 2).toUpperCase()}</span>}
            </div>
            <div>
              <h2 className="detail-title">{item.title}</h2>
              <div className="muted small">
                {item.mediaType === 'tv' ? 'TV show' : 'Movie'}
                {item.year ? ` • ${item.year}` : ''}
              </div>
            </div>
          </div>
          <button type="button" className="follow-icon-btn" onClick={onClose} aria-label="Close details">
            <X size={16} />
          </button>
        </div>

        {item.overview && <p className="detail-overview">{item.overview}</p>}

        {item.mediaType === 'tv' && isFollowed && (
          <div className="panel compact-panel">
            {follow?.untracked ? (
              <span className="muted small">Episode alerts aren’t available: no TVmaze match for this show.</span>
            ) : status ? (
              <div className="small">
                <div>
                  Next episode:{' '}
                  <strong>
                    {status.next
                      ? `S${status.next.season}E${status.next.number ?? '?'} • ${formatDate(status.next.airdate)}`
                      : 'none scheduled'}
                  </strong>
                </div>
                {status.previous && (
                  <div className="muted">
                    Latest: S{status.previous.season}E{status.previous.number ?? '?'} “{status.previous.name}” •{' '}
                    {formatDate(status.previous.airdate)}
                  </div>
                )}
              </div>
            ) : (
              <span className="muted small">Episode info loads on the next check.</span>
            )}
          </div>
        )}

        <div className="detail-section-label">Where to watch (US)</div>
        <WatchOptionsFull options={options} />
        {options?.link && (
          <a className="fineprint-link" href={options.link} target="_blank" rel="noopener noreferrer">
            More options on TMDB <ExternalLink size={11} />
          </a>
        )}
        <p className="fineprint">Where-to-watch data by JustWatch, via TMDB. Availability can change.</p>

        <div className="detail-actions">
          <button type="button" className="primary-btn" onClick={() => onToggleFollow(item)}>
            {isFollowed ? (
              <>
                <Check size={16} /> Watchlisted
              </>
            ) : item.mediaType === 'tv' ? (
              <>
                <BellRing size={16} /> Add to Watchlist
              </>
            ) : (
              <>
                <Bookmark size={16} /> Add to Watchlist
              </>
            )}
          </button>
          <button type="button" className="secondary-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
