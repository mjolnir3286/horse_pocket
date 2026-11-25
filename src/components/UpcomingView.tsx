import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Bookmark,
  BookmarkCheck,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Rss,
} from 'lucide-react';
import type { CollectorOutput, UpcomingReleaseLead } from '../types/collector';
import type { PlatformId, StreamingPlatform } from '../types/streaming';

interface UpcomingViewProps {
  collectorData: CollectorOutput | null;
  platformsById: Record<PlatformId, StreamingPlatform>;
  isLeadFollowed: (lead: UpcomingReleaseLead) => boolean;
  onToggleFollowLead: (lead: UpcomingReleaseLead) => void;
  onTriggerFollowedAlerts: () => void;
}

type StatusFilter = 'all' | 'confirmed' | 'unconfirmed' | 'followed';

export const UpcomingView: React.FC<UpcomingViewProps> = ({
  collectorData,
  platformsById,
  isLeadFollowed,
  onToggleFollowLead,
  onTriggerFollowedAlerts,
}) => {
  const [filter, setFilter] = useState<StatusFilter>('all');

  const leads = (collectorData?.leads ?? []).filter((l) => l.availabilityStatus === 'upcoming');
  const followedLeadsCount = useMemo(
    () => leads.filter((l) => isLeadFollowed(l)).length,
    [leads, isLeadFollowed]
  );

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (filter === 'confirmed') return lead.confirmationStatus === 'confirmed';
      if (filter === 'unconfirmed') return lead.confirmationStatus === 'unconfirmed';
      if (filter === 'followed') return isLeadFollowed(lead);
      return true;
    });
  }, [leads, filter, isLeadFollowed]);

  if (!collectorData) {
    return (
      <div className="panel" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
        Loading collected release leads… Run <code>npm run collect</code> to poll RSS feeds.
      </div>
    );
  }

  return (
    <div>
      <div className="panel">
        <div className="panel-row">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <Rss size={17} color="var(--accent-bright)" />
              Upcoming Releases (RSS Alert Collector)
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>
              Polled {collectorData.feedsPolled.length} public feeds ({collectorData.totalRawItems}{' '}
              items) • {collectorData.upcomingCount ?? leads.length} upcoming •{' '}
              {collectorData.availableNowCount ?? 0} available now (shown on Platforms) • Updated{' '}
              {new Date(collectorData.generatedAt).toLocaleString()}
            </div>
          </div>

          <button
            type="button"
            className="primary-btn"
            disabled={followedLeadsCount === 0}
            onClick={onTriggerFollowedAlerts}
          >
            <BellRing size={15} />
            Notify Followed ({followedLeadsCount})
          </button>
        </div>

        <div className="tech-note">
          <strong>How it works:</strong> Public RSS feeds (Google News queries, Deadline, Variety,
          TVLine) are scanned for premiere/release keywords, parsed with <code>chrono-node</code>,
          and cross-checked against <strong>TVmaze</strong>. Unverified news leads stay{' '}
          <strong>Unconfirmed</strong>; TVmaze schedule matches become <strong>Confirmed</strong>.
        </div>
      </div>

      <div className="chip-scroll" aria-label="Filter upcoming releases">
        {(
          [
            ['all', `All (${leads.length})`],
            [
              'confirmed',
              `Confirmed (${leads.filter((l) => l.confirmationStatus === 'confirmed').length})`,
            ],
            [
              'unconfirmed',
              `Unconfirmed (${leads.filter((l) => l.confirmationStatus === 'unconfirmed').length})`,
            ],
            ['followed', `Followed Matches (${followedLeadsCount})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`filter-chip ${filter === key ? 'active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="section-heading">
        <h2>Detected Upcoming & Premiere Leads</h2>
        <span className="section-meta">{filteredLeads.length} shown</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredLeads.map((lead) => {
          const isConfirmed = lead.confirmationStatus === 'confirmed';
          const followed = isLeadFollowed(lead);
          const platform = lead.platformId !== 'unknown' ? platformsById[lead.platformId] : null;
          const dateLabel = lead.parsedDateIso
            ? `${lead.parsedDateIso} (${lead.datePrecision})`
            : lead.extractedDateText
              ? `${lead.extractedDateText} (${lead.datePrecision})`
              : 'Date unclear';

          return (
            <article key={lead.id} className="panel" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: isConfirmed ? 'var(--success-soft)' : 'var(--warning-soft)',
                        color: isConfirmed ? 'var(--success-text)' : 'var(--warning-text)',
                      }}
                    >
                      {isConfirmed ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                      {isConfirmed ? 'CONFIRMED' : 'UNCONFIRMED'}
                    </span>

                    <span
                      style={{
                        fontSize: '0.68rem',
                        color: 'var(--text-muted)',
                        padding: '2px 7px',
                        borderRadius: 999,
                        background: 'var(--subtle-fill)',
                      }}
                    >
                      Confidence {Math.round(lead.confidenceScore * 100)}%
                    </span>

                    {followed && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: 'var(--accent-bright)',
                        }}
                      >
                        ★ Following
                      </span>
                    )}
                  </div>

                  <h3 style={{ margin: '7px 0 4px', fontSize: '0.98rem' }}>{lead.showTitle}</h3>
                </div>

                <button
                  type="button"
                  className={`follow-icon-btn ${followed ? 'following' : ''}`}
                  aria-label={followed ? `Unfollow ${lead.showTitle}` : `Follow ${lead.showTitle}`}
                  title={followed ? 'Following (triggers alert)' : 'Follow this show'}
                  onClick={() => onToggleFollowLead(lead)}
                >
                  {followed ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center',
                  fontSize: '0.78rem',
                  marginBottom: 7,
                }}
              >
                <span className="platform-pill">
                  <span
                    className="platform-dot"
                    style={{ backgroundColor: platform?.brandColor ?? '#64748b' }}
                  />
                  {lead.platformName}
                </span>

                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text)' }}>
                  <Calendar size={13} color="var(--accent-bright)" /> {dateLabel}
                </span>
              </div>

              {lead.tvmaze?.nextEpisodeAirDate && (
                <div
                  style={{
                    fontSize: '0.76rem',
                    color: 'var(--success-text)',
                    marginBottom: 6,
                  }}
                >
                  TVmaze verified: S{lead.tvmaze.nextEpisodeSeason}E{lead.tvmaze.nextEpisodeNumber} “
                  {lead.tvmaze.nextEpisodeName}” on {lead.tvmaze.nextEpisodeAirDate}
                </div>
              )}

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {lead.rawHeadline}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 8,
                  fontSize: '0.71rem',
                  color: 'var(--text-soft)',
                  gap: 8,
                }}
              >
                <span>Source: {lead.sourceName}</span>
                {lead.sourceUrl && (
                  <a
                    href={lead.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="pill-btn"
                    style={{ textDecoration: 'none', padding: '3px 9px', fontSize: '0.7rem' }}
                  >
                    Article <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
