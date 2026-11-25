import React, { useEffect, useState } from 'react';
import { DollarSign, ExternalLink, TrendingUp } from 'lucide-react';
import type { UpcomingReleaseLead } from '../types/collector';
import type { StreamingPlatform } from '../types/streaming';
import { getPopularOnProvider, type TmdbTitle } from '../services/tmdb';

interface PlatformPageProps {
  platforms: StreamingPlatform[];
  availableNowLeads: UpcomingReleaseLead[];
  onSelectTitle: (title: TmdbTitle) => void;
}

function formatChecked(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const PopularList: React.FC<{ platform: StreamingPlatform; onSelectTitle: (t: TmdbTitle) => void }> = ({
  platform,
  onSelectTitle,
}) => {
  const [titles, setTitles] = useState<TmdbTitle[] | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    getPopularOnProvider('tv', platform.tmdbProviderIds, 3)
      .then((t) => active && setTitles(t))
      .catch(() => active && setTitles(null));
    return () => {
      active = false;
    };
  }, [platform]);

  return (
    <div className="top3-list">
      <div className="top3-heading">
        <TrendingUp size={13} /> Popular shows streaming on {platform.name}
      </div>
      {titles === undefined && <div className="muted small">Loading…</div>}
      {titles === null && <div className="muted small">Unavailable right now.</div>}
      {titles?.length === 0 && <div className="muted small">No titles listed.</div>}
      {titles?.map((t, idx) => (
        <button key={t.id} type="button" className="top3-item" onClick={() => onSelectTitle(t)}>
          <span className="top3-left">
            <span className="top3-rank">{idx + 1}</span>
            <span className="top3-name">{t.title}</span>
          </span>
          <span className="muted small">{t.year ?? ''}</span>
        </button>
      ))}
      <div className="fineprint">Ranked by TMDB popularity among shows TMDB lists as streaming here (US). Not an official chart.</div>
    </div>
  );
};

export const PlatformPage: React.FC<PlatformPageProps> = ({ platforms, availableNowLeads, onSelectTitle }) => {
  const renderCard = (platform: StreamingPlatform) => {
    const recentLeads = availableNowLeads.filter((l) => l.platformId === platform.id);
    return (
      <article key={platform.id} className="platform-card">
        <div className="platform-card-header">
          <div className="platform-identity">
            <div className="platform-avatar" style={{ background: platform.brandColor }}>
              {platform.shortCode}
            </div>
            <div>
              <h3 className="platform-name">{platform.name}</h3>
              <div className="platform-tagline">{platform.tagline}</div>
            </div>
          </div>
          <a href={platform.websiteUrl} target="_blank" rel="noopener noreferrer" className="pill-btn">
            Site <ExternalLink size={12} />
          </a>
        </div>

        <div className="plan-box">
          <div className="plan-head">
            <DollarSign size={12} /> US plans (regular prices, before tax)
          </div>
          {platform.plans.map((plan) => (
            <div key={plan.name}>
              <div className="plan-row">
                <span>
                  {plan.name} <span className="muted tiny">({plan.hasAds ? 'ads' : 'no ads'})</span>
                </span>
                <span className={plan.monthlyPrice ? 'plan-price' : 'plan-price unverified'}>
                  {plan.monthlyPrice ?? 'Not verified'}
                </span>
              </div>
              {(plan.annualPrice || plan.notes) && (
                <div className="plan-notes">{[plan.annualPrice, plan.notes].filter(Boolean).join(' • ')}</div>
              )}
            </div>
          ))}
          {platform.pricingNote && <div className="plan-notes">{platform.pricingNote}</div>}
          <a className="fineprint-link" href={platform.pricingUrl} target="_blank" rel="noopener noreferrer">
            Checked {formatChecked(platform.pricesCheckedOn)} on the official page <ExternalLink size={11} />
          </a>
        </div>

        <PopularList platform={platform} onSelectTitle={onSelectTitle} />

        {recentLeads.length > 0 && (
          <div className="top3-list">
            <div className="top3-heading">Recently released (Upcoming feed)</div>
            {recentLeads.slice(0, 8).map((lead) => (
              <div key={lead.id} className="top3-item static">
                <span className="top3-name">{lead.showTitle}</span>
                <span className="muted small">{lead.parsedDateIso ?? lead.extractedDateText ?? ''}</span>
              </div>
            ))}
          </div>
        )}
      </article>
    );
  };

  const priority = platforms.filter((p) => p.tier === 'priority');
  const secondary = platforms.filter((p) => p.tier === 'secondary');
  return (
    <div>
      <div className="section-heading">
        <h2>Main services</h2>
        <span className="section-meta">Prices hand-checked</span>
      </div>
      <div className="platform-list">{priority.map(renderCard)}</div>
      <div className="section-heading">
        <h2>More services</h2>
        <span className="section-meta">{secondary.length} services</span>
      </div>
      <div className="platform-list">{secondary.map(renderCard)}</div>
    </div>
  );
};
