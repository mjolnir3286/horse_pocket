import React from 'react';
import { Bell, BellRing, Check, ExternalLink, Tv, X } from 'lucide-react';
import type { MediaTitle, PlatformId, StreamingPlatform } from '../types/streaming';

interface TitleDetailModalProps {
  item: MediaTitle | null;
  platformsById: Record<PlatformId, StreamingPlatform>;
  isFollowed: boolean;
  onToggleFollow: (id: string) => void;
  onClose: () => void;
}

export const TitleDetailModal: React.FC<TitleDetailModalProps> = ({
  item,
  platformsById,
  isFollowed,
  onToggleFollow,
  onClose,
}) => {
  if (!item) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div
              className="poster-tile"
              style={{
                width: 58,
                height: 82,
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
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{item.title}</h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {item.type === 'series' ? 'TV Series' : 'Movie'} • {item.releaseYear} • {item.rating} •{' '}
                {item.genres.join(', ')}
              </div>
              {item.type === 'series' && (
                <div style={{ fontSize: '0.76rem', color: 'var(--success)', marginTop: 4 }}>
                  {item.ongoing ? 'Ongoing series — new episode alerts supported' : 'Completed series'}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 999,
              width: 32,
              height: 32,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '14px 0' }}>{item.synopsis}</p>

        {item.latestEpisode && (
          <div className="panel" style={{ marginBottom: 12, padding: 11 }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700 }}>
              EPISODE TRACKER (EXAMPLE DATA)
            </div>
            <div style={{ fontSize: '0.84rem', marginTop: 4 }}>
              Latest: <strong>S{item.latestEpisode.season}E{item.latestEpisode.episode}</strong> — “
              {item.latestEpisode.title}” ({item.latestEpisode.airDate})
            </div>
            {item.upcomingEpisode && (
              <div style={{ fontSize: '0.82rem', color: 'var(--accent-bright)', marginTop: 3 }}>
                Next: <strong>S{item.upcomingEpisode.season}E{item.upcomingEpisode.episode}</strong> — “
                {item.upcomingEpisode.title}” (est. {item.upcomingEpisode.airDate})
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
            WHERE TO WATCH ({item.availability.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {item.availability.map((avail) => {
              const platform = platformsById[avail.platformId];
              if (!platform) return null;
              const cheapestPlan = platform.plans[0];
              return (
                <div
                  key={avail.platformId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      className="platform-avatar"
                      style={{ width: 34, height: 34, fontSize: '0.75rem', background: platform.brandColor }}
                    >
                      {platform.shortCode}
                    </span>
                    <div>
                      <div style={{ fontWeight: 650, fontSize: '0.9rem' }}>
                        {platform.name}{' '}
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                          • {avail.quality}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {avail.accessType === 'subscription'
                          ? `Subscription required (from ${cheapestPlan?.monthlyPrice ?? 'varies'})`
                          : `${avail.accessType.toUpperCase()} ${avail.note ? `• ${avail.note}` : ''}`}
                      </div>
                    </div>
                  </div>
                  <a
                    href={platform.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="pill-btn"
                    style={{ textDecoration: 'none' }}
                  >
                    Open <ExternalLink size={12} />
                  </a>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-soft)', marginTop: 6 }}>
            Plan costs shown are example/approximate data as of Nov 2026.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="primary-btn"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => onToggleFollow(item.id)}
          >
            {isFollowed ? (
              <>
                <Check size={16} /> Following in Watchlist
              </>
            ) : item.type === 'series' ? (
              <>
                <BellRing size={16} /> Follow & Enable Episode Alerts
              </>
            ) : (
              <>
                <Bell size={16} /> Save to Watchlist
              </>
            )}
          </button>
          <button type="button" className="secondary-btn" onClick={onClose}>
            <Tv size={15} /> Done
          </button>
        </div>
      </div>
    </div>
  );
};
