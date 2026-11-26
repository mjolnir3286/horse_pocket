import React, { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, BellRing, RefreshCw, Trash2, X } from 'lucide-react';
import type { NewEpisodeAlert } from '../types/streaming';
import type { NotificationSupportState } from '../services/notifications';
import type { FollowedTitle } from '../services/follows';
import { posterUrl } from '../services/tmdb';
import { useMediaQuery } from '../lib/useMediaQuery';
import {
  applyWatchlistView,
  readWatchlistView,
  WATCHLIST_SORT_OPTIONS,
  WATCHLIST_TYPE_FILTERS,
  writeWatchlistView,
  type WatchlistSortKey,
  type WatchlistViewState,
} from '../lib/watchlistView';
import { HideWatchedToggle } from './HideWatchedToggle';
import { WatchedButton } from './WatchedButton';

interface WatchlistViewProps {
  follows: FollowedTitle[];
  alerts: NewEpisodeAlert[];
  permissionState: NotificationSupportState;
  checking: boolean;
  lastCheckedAt: string | null;
  onRequestPermission: () => void;
  onCheckNow: () => void;
  onUnfollow: (key: string) => void;
  onOpen: (follow: FollowedTitle) => void;
  onClearAlerts: () => void;
  watchedState: (follow: FollowedTitle) => { watched: boolean; partial: string | null; caughtUp: boolean };
  onToggleWatched: (follow: FollowedTitle) => void;
  hideWatched: boolean;
  onHideWatchedChange: (hide: boolean) => void;
  watchNext: React.ReactNode;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'TBA';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function episodeLine(f: FollowedTitle): string {
  if (f.mediaType === 'movie') return 'Movie • saved';
  if (f.untracked) return 'No TVmaze match, so no episode alerts';
  const s = f.lastStatus;
  if (!s) return 'Checking episodes…';
  if (s.next) return `Next: S${s.next.season}E${s.next.number ?? '?'} • ${formatDate(s.next.airdate)}`;
  if (s.showStatus === 'Ended') return 'Series ended';
  return 'No next episode scheduled yet';
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  follows,
  alerts,
  permissionState,
  checking,
  lastCheckedAt,
  onRequestPermission,
  onCheckNow,
  onUnfollow,
  onOpen,
  onClearAlerts,
  watchedState,
  onToggleWatched,
  hideWatched,
  onHideWatchedChange,
  watchNext,
}) => {
  const compactSort = useMediaQuery('(max-width: 520px)');
  const [view, setView] = useState<WatchlistViewState>(() => readWatchlistView());

  useEffect(() => {
    writeWatchlistView(view);
  }, [view]);

  const permissionLabel =
    permissionState === 'granted'
      ? 'On'
      : permissionState === 'denied'
        ? 'Blocked in browser settings (alerts still show here)'
        : permissionState === 'unsupported'
          ? 'Not supported in this browser (alerts still show here)'
          : 'Off';

  const { typeFilteredCount, items: visible } = useMemo(
    () =>
      applyWatchlistView(
        follows,
        view,
        hideWatched ? (f) => watchedState(f).caughtUp : undefined
      ),
    [follows, view, hideWatched, watchedState]
  );

  return (
    <div>
      <div className="panel">
        <div className="panel-row">
          <div>
            <div className="panel-title">
              {permissionState === 'granted' ? <BellRing size={17} /> : <BellOff size={17} />}
              New episode alerts: {permissionLabel}
            </div>
            <div className="muted small">
              Couch checks your Watchlist each time you open it.
              {lastCheckedAt ? ` Last checked ${new Date(lastCheckedAt).toLocaleString()}.` : ''}
            </div>
          </div>
          <div className="button-row">
            {permissionState === 'default' && (
              <button type="button" className="secondary-btn" onClick={onRequestPermission}>
                <Bell size={15} /> Turn on
              </button>
            )}
            <button type="button" className="primary-btn" disabled={checking || follows.length === 0} onClick={onCheckNow}>
              <RefreshCw size={15} />
              {checking ? 'Checking…' : 'Check now'}
            </button>
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="panel">
          <div className="panel-row">
            <div className="panel-title">New episodes ({alerts.length})</div>
            <button type="button" className="text-btn" onClick={onClearAlerts}>
              <Trash2 size={13} /> Clear
            </button>
          </div>
          {alerts.map((a) => (
            <div key={a.id} className="alert-item">
              <div>
                <div className="alert-title">
                  {a.showTitle} • S{a.season}E{a.episode} “{a.episodeTitle}”
                </div>
                <div className="muted small">
                  Aired {formatDate(a.airdate)}
                  {a.network ? ` on ${a.network}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {watchNext}

      <div className="section-heading watchlist-heading">
        <div className="watchlist-heading-text">
          <h2>Your Watchlist</h2>
          <span className="section-meta">Saved on this device</span>
        </div>
      </div>

      {follows.length > 0 && (
        <div className="watchlist-controls">
          <div className="chip-scroll" role="group" aria-label="Filter watchlist by type">
            {WATCHLIST_TYPE_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`filter-chip ${view.typeFilter === value ? 'active' : ''}`}
                aria-pressed={view.typeFilter === value}
                onClick={() => setView((prev) => ({ ...prev, typeFilter: value }))}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="watchlist-controls-right">
            <label className="sort-control">
              <span className="section-meta sort-label">Sort</span>
              <select
                className="sort-select"
                value={view.sort}
                onChange={(e) => setView((prev) => ({ ...prev, sort: e.target.value as WatchlistSortKey }))}
                aria-label="Sort watchlist"
              >
                {WATCHLIST_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {compactSort ? option.shortLabel : option.label}
                  </option>
                ))}
              </select>
            </label>
            <HideWatchedToggle hidden={hideWatched} onChange={onHideWatchedChange} />
          </div>
        </div>
      )}

      {follows.length === 0 ? (
        <div className="panel empty-panel">
          Nothing here yet. Open a show or movie and tap Add to Watchlist.
        </div>
      ) : visible.length === 0 ? (
        typeFilteredCount === 0 ? (
          <div className="panel empty-panel">
            No {view.typeFilter === 'tv' ? 'shows' : 'movies'} on your Watchlist.
            <button type="button" className="text-btn" onClick={() => setView((prev) => ({ ...prev, typeFilter: 'all' }))}>
              Show all
            </button>
          </div>
        ) : (
          <div className="panel empty-panel">
            All caught up.
            <button type="button" className="text-btn" onClick={() => onHideWatchedChange(false)}>
              Show watched
            </button>
          </div>
        )
      ) : (
        <div className="watch-list">
          {visible.map((f) => {
            const poster = posterUrl(f.posterPath, 'w92');
            const ws = watchedState(f);
            return (
              <div key={f.key} className={`watch-row ${ws.watched ? 'is-watched' : ''}`} data-watch-key={f.key} data-title={f.title}>
                <button type="button" className="watch-row-main" onClick={() => onOpen(f)}>
                  <span className="watch-thumb">
                    {poster ? <img src={poster} alt="" loading="lazy" /> : <span>{f.title.slice(0, 2).toUpperCase()}</span>}
                  </span>
                  <span className="watch-row-text">
                    <span className="watch-row-title">
                      {f.title}
                      {f.year ? <span className="muted"> ({f.year})</span> : null}
                    </span>
                    <span className="muted small">
                      {episodeLine(f)}
                      {f.lastStatus?.network ? ` • ${f.lastStatus.network}` : ''}
                    </span>
                    {(ws.watched || ws.partial) && (
                      <span className="watched-tag tiny">{ws.watched ? 'Watched' : ws.partial}</span>
                    )}
                  </span>
                </button>
                <WatchedButton watched={ws.watched} partial={ws.partial} title={f.title} onToggle={() => onToggleWatched(f)} />
                <button type="button" className="follow-icon-btn" aria-label={`Remove ${f.title} from Watchlist`} title="Remove" onClick={() => onUnfollow(f.key)}>
                  <X size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
