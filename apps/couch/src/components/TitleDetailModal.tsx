import React, { useEffect, useRef, useState } from 'react';
import { BellRing, Bookmark, Check, CheckCircle2, Circle, ExternalLink, X } from 'lucide-react';
import { getWatchOptions, posterUrl, type TmdbTitle, type WatchOptions } from '../services/tmdb';
import type { FollowedTitle } from '../services/follows';
import type { TvmazeEpisode } from '../services/tvmaze';
import { isTitleWatched, type WatchedEntry } from '../services/watched';
import { EpisodesSection } from './EpisodesSection';
import { WatchOptionsFull } from './WatchOptions';
import { MoreLikeThis } from './MoreLikeThis';
import { safeHttpUrl } from '../lib/safeUrl';

/** A TMDB title, or a TVmaze-only show from the Upcoming feed (tmdbless). */
export type DetailItem = TmdbTitle & { tvmazeId?: number | null; tmdbless?: boolean; platformName?: string };

interface TitleDetailModalProps {
  item: DetailItem | null;
  follow: FollowedTitle | undefined;
  watchedEntry: WatchedEntry | undefined;
  onToggleFollow: (item: DetailItem) => void;
  onToggleWatched: (item: DetailItem, currentlyWatched: boolean) => void;
  onSetEpisodes: (item: DetailItem, episodes: TvmazeEpisode[], watched: boolean) => void;
  onTvmazeResolved?: (item: DetailItem, tvmazeId: number | null) => void;
  onClose: () => void;
  onOptionsLoaded?: (item: TmdbTitle, options: WatchOptions) => void;
  /** More like this: open another title in this sheet, and its Watchlist / hide-watched state. */
  onSelectTitle?: (t: TmdbTitle) => void;
  isTitleFollowed?: (t: TmdbTitle) => boolean;
  onToggleFollowTitle?: (t: TmdbTitle) => void;
  isTitleHidden?: (t: TmdbTitle) => boolean;
  isTitleWatchedMark?: (t: TmdbTitle) => boolean;
  onToggleWatchedTitle?: (t: TmdbTitle) => void;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'TBA';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export const TitleDetailModal: React.FC<TitleDetailModalProps> = ({
  item,
  follow,
  watchedEntry,
  onToggleFollow,
  onToggleWatched,
  onSetEpisodes,
  onTvmazeResolved,
  onClose,
  onOptionsLoaded,
  onSelectTitle,
  isTitleFollowed,
  onToggleFollowTitle,
  isTitleHidden,
  isTitleWatchedMark,
  onToggleWatchedTitle,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [options, setOptions] = useState<WatchOptions | null | undefined>(undefined);
  const [caughtUp, setCaughtUp] = useState<boolean | null>(null);

  useEffect(() => {
    setCaughtUp(null);
    // Opening a title from More like this swaps the sheet's content: start at the top.
    sheetRef.current?.scrollTo?.({ top: 0 });
  }, [item]);

  useEffect(() => {
    if (!item) return;
    if (item.tmdbless) {
      setOptions(null);
      return;
    }
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
  const watched = item.mediaType === 'tv' ? (caughtUp ?? isTitleWatched(watchedEntry)) : isTitleWatched(watchedEntry);
  const tvmazeId = item.tvmazeId ?? follow?.tvmazeId ?? watchedEntry?.tvmazeId ?? null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div ref={sheetRef} className="modal-sheet" role="dialog" aria-modal="true" aria-label={item.title} onClick={(e) => e.stopPropagation()}>
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
        {item.tmdbless ? (
          <p className="muted small">
            {item.platformName ? `Announced for ${item.platformName}. ` : ''}Full where-to-watch needs a TMDB match; search it in Discover.
          </p>
        ) : (
          <WatchOptionsFull options={options} />
        )}
        {safeHttpUrl(options?.link) && (
          <a className="fineprint-link" href={safeHttpUrl(options?.link) ?? undefined} target="_blank" rel="noopener noreferrer">
            More options on TMDB <ExternalLink size={11} />
          </a>
        )}
        <p className="fineprint">Where-to-watch data by JustWatch, via TMDB. Availability can change.</p>

        {item.mediaType === 'tv' && (
          <EpisodesSection
            key={`${item.mediaType}-${item.id}-${tvmazeId ?? 'x'}`}
            title={item.title}
            tmdbId={item.tmdbless ? null : item.id}
            tvmazeId={tvmazeId}
            entry={watchedEntry}
            showOptions={options}
            onTvmazeResolved={(id) => onTvmazeResolved?.(item, id)}
            onSetEpisodes={(eps, w) => onSetEpisodes(item, eps, w)}
            onCaughtUp={setCaughtUp}
          />
        )}

        {!item.tmdbless && onSelectTitle && onToggleFollowTitle && onToggleWatchedTitle && (
          <MoreLikeThis
            mediaType={item.mediaType}
            id={item.id}
            title={item.title}
            isHidden={isTitleHidden ?? (() => false)}
            isFollowed={isTitleFollowed ?? (() => false)}
            isWatched={isTitleWatchedMark ?? (() => false)}
            onToggleFollow={onToggleFollowTitle}
            onToggleWatched={onToggleWatchedTitle}
            onSelect={onSelectTitle}
          />
        )}

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
          <button
            type="button"
            className={`secondary-btn watched-action ${watched ? 'is-watched' : ''}`}
            aria-pressed={watched}
            aria-label={watched ? 'Unmark watched' : item.mediaType === 'tv' ? 'Mark show watched' : 'Mark watched'}
            onClick={() => onToggleWatched(item, watched)}
            title={item.mediaType === 'tv' && !watched ? 'Marks every aired episode watched and adds the show to your Watchlist' : undefined}
          >
            {watched ? <CheckCircle2 size={16} /> : <Circle size={16} />} Watched
          </button>
        </div>
      </div>
    </div>
  );
};
