import React from 'react';
import { Bell, BellOff, BellRing, CheckCircle2, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import type { MediaTitle, NewEpisodeAlert, PlatformId, StreamingPlatform } from '../types/streaming';
import type { NotificationSupportState } from '../services/notifications';
import { TitleCard } from './TitleCard';

interface WatchlistViewProps {
  followedTitles: MediaTitle[];
  platformsById: Record<PlatformId, StreamingPlatform>;
  alerts: NewEpisodeAlert[];
  permissionState: NotificationSupportState;
  checking: boolean;
  onRequestPermission: () => void;
  onCheckNewEpisodes: () => void;
  onToggleFollow: (id: string) => void;
  onSelectTitle: (title: MediaTitle) => void;
  onClearAlerts: () => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  followedTitles,
  platformsById,
  alerts,
  permissionState,
  checking,
  onRequestPermission,
  onCheckNewEpisodes,
  onToggleFollow,
  onSelectTitle,
  onClearAlerts,
}) => {
  const permissionLabel =
    permissionState === 'granted'
      ? 'Enabled (Service Worker ready)'
      : permissionState === 'denied'
        ? 'Blocked in browser settings (using in-app alerts)'
        : permissionState === 'unsupported'
          ? 'Browser Notification API unavailable (using in-app alerts)'
          : 'Not enabled yet';

  return (
    <div>
      <div className="panel">
        <div className="panel-row">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              {permissionState === 'granted' ? (
                <BellRing size={17} color="#10b981" />
              ) : (
                <BellOff size={17} color="#f59e0b" />
              )}
              New Episode Push Alerts
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>
              Status: <strong>{permissionLabel}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {permissionState !== 'granted' && permissionState !== 'unsupported' && (
              <button type="button" className="secondary-btn" onClick={onRequestPermission}>
                <Bell size={15} /> Enable Push Alerts
              </button>
            )}
            <button
              type="button"
              className="primary-btn"
              disabled={checking || followedTitles.length === 0}
              onClick={onCheckNewEpisodes}
            >
              <RefreshCw size={15} />
              {checking ? 'Checking...' : 'Check for New Episodes'}
            </button>
          </div>
        </div>

        <div className="tech-note">
          <strong>How real push works:</strong> This MVP uses the browser Service Worker +
          Notification API to simulate an episode check locally. In production, a scheduled backend
          worker checks TMDB’s <code>/tv/&#123;id&#125;</code> episode air dates and sends real
          background pushes via <strong>Web Push (VAPID)</strong> for PWA users and{' '}
          <strong>Firebase Cloud Messaging (FCM)</strong> for an Android Capacitor build.
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="panel">
          <div className="panel-row" style={{ marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: '0.9rem' }}>
              <Sparkles size={15} color="#10b981" /> Recent Episode Alerts ({alerts.length})
            </div>
            <button type="button" className="ad-dismiss-btn" onClick={onClearAlerts}>
              <Trash2 size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              Clear
            </button>
          </div>

          {alerts.map((alert) => {
            const p = platformsById[alert.platformId];
            return (
              <div key={alert.id} className="alert-item">
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 650 }}>
                    {alert.showTitle} — S{alert.season}E{alert.episode}: “{alert.episodeTitle}”
                  </div>
                  <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                    Streaming on {p ? p.name : alert.platformId} • Simulated push delivered
                  </div>
                </div>
                <CheckCircle2 size={16} color="#10b981" />
              </div>
            );
          })}
        </div>
      )}

      <div className="section-heading">
        <h2>Your Watchlist ({followedTitles.length})</h2>
        <span className="section-meta">Tap bookmark to follow/unfollow</span>
      </div>

      {followedTitles.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 28 }}>
          Your watchlist is empty. Search for a show on the Discover tab and tap the bookmark icon
          to follow new episodes.
        </div>
      ) : (
        <div className="card-grid">
          {followedTitles.map((item) => (
            <TitleCard
              key={item.id}
              item={item}
              platformsById={platformsById}
              isFollowed={true}
              onToggleFollow={onToggleFollow}
              onSelect={onSelectTitle}
            />
          ))}
        </div>
      )}
    </div>
  );
};
