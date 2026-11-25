import React, { useState } from 'react';
import { ChevronDown, ChevronUp, DollarSign, ExternalLink, Star, TrendingUp } from 'lucide-react';
import type { UpcomingReleaseLead } from '../types/collector';
import type { MediaTitle, PlatformId, StreamingPlatform } from '../types/streaming';
import { NativeAdCard } from './AdSlot';

interface PlatformPageProps {
  platforms: StreamingPlatform[];
  titlesById: Record<string, MediaTitle>;
  allTitles: MediaTitle[];
  followedIds: string[];
  isPremium: boolean;
  availableNowLeads: UpcomingReleaseLead[];
  onEnablePremium: () => void;
  onSelectTitle: (title: MediaTitle) => void;
}

export const PlatformPage: React.FC<PlatformPageProps> = ({
  platforms,
  titlesById,
  allTitles,
  followedIds,
  isPremium,
  availableNowLeads,
  onEnablePremium,
  onSelectTitle,
}) => {
  const [expandedId, setExpandedId] = useState<PlatformId | null>(null);

  const priorityPlatforms = platforms.filter((p) => p.tier === 'priority');
  const secondaryPlatforms = platforms.filter((p) => p.tier === 'secondary');

  const renderPlatformCard = (platform: StreamingPlatform) => {
    const top3 = platform.top3ShowIds
      .map((id) => titlesById[id])
      .filter((t): t is MediaTitle => Boolean(t));

    const watchlistMatches = allTitles.filter(
      (t) =>
        followedIds.includes(t.id) &&
        t.availability.some((a) => a.platformId === platform.id)
    ).length;

    const isExpanded = expandedId === platform.id;
    const platformTitles = allTitles.filter((t) =>
      t.availability.some((a) => a.platformId === platform.id)
    );

    return (
      <article key={platform.id} className="platform-card">
        <div className="platform-card-header">
          <div className="platform-identity">
            <div className="platform-avatar" style={{ background: platform.brandColor }}>
              {platform.shortCode}
            </div>
            <div>
              <h3 className="platform-name">
                {platform.name}{' '}
                {platform.tier === 'priority' && (
                  <span
                    style={{
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 999,
                      background: 'var(--accent-soft)',
                      color: 'var(--accent-bright)',
                      verticalAlign: 'middle',
                      marginLeft: 4,
                    }}
                  >
                    Priority
                  </span>
                )}
              </h3>
              <div className="platform-tagline">{platform.tagline}</div>
            </div>
          </div>

          <span className="sub-badge">
            {platform.subscriptionRequired ? 'Sub Required' : 'Free Tier'}
          </span>
        </div>

        <div className="plan-box">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              fontWeight: 650,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <DollarSign size={12} /> Plans & Cost ({platform.pricingDisclaimer})
            </span>
            {watchlistMatches > 0 && (
              <span style={{ color: 'var(--success)' }}>
                {watchlistMatches} in your Watchlist
              </span>
            )}
          </div>

          {platform.plans.map((plan) => (
            <div key={plan.name}>
              <div className="plan-row">
                <span>
                  {plan.name}{' '}
                  <span style={{ fontSize: '0.69rem', color: 'var(--text-soft)' }}>
                    ({plan.hasAds ? 'Ads' : 'Ad-Free'})
                  </span>
                </span>
                <span className="plan-price">{plan.monthlyPrice}</span>
              </div>
              <div className="plan-notes">
                {plan.notes}
                {plan.annualNote ? ` • ${plan.annualNote}` : ''}
              </div>
            </div>
          ))}
        </div>

        <div className="top3-list">
          <div className="top3-heading" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <TrendingUp size={13} color="var(--accent-bright)" /> Top 3 Shows on {platform.name}
          </div>
          {top3.map((show, idx) => (
            <button
              key={show.id}
              type="button"
              className="top3-item"
              onClick={() => onSelectTitle(show)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                <span className="top3-rank">#{idx + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {show.title}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {show.genres.slice(0, 2).join(' • ')}
                    {show.latestEpisode
                      ? ` • S${show.latestEpisode.season}E${show.latestEpisode.episode}`
                      : ''}
                  </div>
                </div>
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: '0.74rem',
                  color: 'var(--warning)',
                  flexShrink: 0,
                }}
              >
                <Star size={12} fill="#f59e0b" color="#f59e0b" /> {show.score.toFixed(1)}
              </span>
            </button>
          ))}
        </div>

        {(() => {
          const recentLeads = availableNowLeads.filter((l) => l.platformId === platform.id);
          if (recentLeads.length === 0) return null;
          return (
            <div className="top3-list">
              <div className="top3-heading">Available now / recently released</div>
              {recentLeads.map((lead) => (
                <div key={lead.id} className="top3-item" style={{ cursor: 'default' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>{lead.showTitle}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {lead.parsedDateIso ?? lead.extractedDateText ?? 'Recently listed'} •{' '}
                      {lead.confirmationStatus === 'confirmed' ? 'Confirmed' : 'Unconfirmed'}
                    </div>
                  </div>
                  {lead.sourceUrl && (
                    <a
                      href={lead.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="pill-btn"
                      style={{ textDecoration: 'none', padding: '3px 8px', fontSize: '0.7rem' }}
                    >
                      Source
                    </a>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="pill-btn"
            onClick={() => setExpandedId(isExpanded ? null : platform.id)}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {isExpanded ? 'Hide Catalog' : `Platform Catalog (${platformTitles.length})`}
          </button>

          <a
            href={platform.websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="pill-btn"
            style={{ textDecoration: 'none' }}
          >
            Site <ExternalLink size={12} />
          </a>
        </div>

        {isExpanded && (
          <div
            style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {platform.subscriptionNote}
            </div>
            {platformTitles.map((t) => (
              <button
                key={t.id}
                type="button"
                className="top3-item"
                onClick={() => onSelectTitle(t)}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  {t.title}{' '}
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    ({t.type})
                  </span>
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--accent-bright)' }}>Details →</span>
              </button>
            ))}
          </div>
        )}
      </article>
    );
  };

  return (
    <div>
      <div className="section-heading">
        <h2>Priority Platforms</h2>
        <span className="section-meta">Example pricing • Nov 2026</span>
      </div>
      <div className="platform-list">{priorityPlatforms.map(renderPlatformCard)}</div>

      <div style={{ marginTop: 14 }}>
        <NativeAdCard isPremium={isPremium} onEnablePremium={onEnablePremium} />
      </div>

      <div className="section-heading" style={{ marginTop: 18 }}>
        <h2>Additional Platforms</h2>
        <span className="section-meta">{secondaryPlatforms.length} services</span>
      </div>
      <div className="platform-list">{secondaryPlatforms.map(renderPlatformCard)}</div>
    </div>
  );
};
