import React from 'react';
import { Bell, BellOff, BellRing, RefreshCw, Trash2, X } from 'lucide-react';
import type { NewEpisodeAlert } from '../types/streaming';
import type { NotificationSupportState } from '../services/notifications';
import type { FollowedTitle } from '../services/follows';
import { posterUrl } from '../services/tmdb';

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
}) => {
  const permissionLabel =
    permissionState === 'granted'
      ? 'On'
      : permissionState === 'denied'
        ? 'Blocked in browser settings (alerts still show here)'
        : permissionState === 'unsupported'
          ? 'Not supported in this browser (alerts still show here)'
          : 'Off';

  const sorted = [...follows].sort((a, b) => {
    const an = a.lastStatus?.next?.airdate ?? '9999';
    const bn = b.lastStatus?.next?.airdate ?? '9999';
    return an.localeCompare(bn) || a.title.localeCompare(b.title);
  });

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

      <div className="section-heading">
        <h2>Your Watchlist ({follows.length})</h2>
        <span className="section-meta">Saved on this device</span>
      </div>

      {follows.length === 0 ? (
        <div className="panel empty-panel">
          Nothing here yet. Open a show or movie and tap Add to Watchlist.
        </div>
      ) : (
        <div className="watch-list">
          {sorted.map((f) => {
            const poster = posterUrl(f.posterPath, 'w92');
            return (
              <div key={f.key} className="watch-row">
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
                  </span>
                </button>
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
