import React, { useEffect, useId, useState } from 'react';
import { ChevronDown, ExternalLink, Info, TrendingUp } from 'lucide-react';
import type { UpcomingReleaseLead } from '../types/collector';
import type { PlatformId, StreamingPlatform } from '../types/streaming';
import { PLATFORM_GROUPS } from '../data/platforms';
import { useMyServices } from '../services/myServices';
import { getPopularOnProvider, logoUrl, peekPopularOnProvider, type TmdbTitle } from '../services/tmdb';

interface PlatformPageProps {
  platforms: StreamingPlatform[];
  availableNowLeads: UpcomingReleaseLead[];
  onSelectTitle: (title: TmdbTitle) => void;
  onToggleService: (id: PlatformId, checked: boolean) => void;
}

const TOP = 3;

function peekTop(platform: StreamingPlatform): TmdbTitle[] | undefined {
  const tv = peekPopularOnProvider('tv', platform.tmdbProviderIds, TOP);
  if (!tv) return undefined;
  if (tv.length > 0) return tv;
  return peekPopularOnProvider('movie', platform.tmdbProviderIds, TOP);
}

/** Popular shows, or movies when a service lists no shows (cached 24 hours). */
async function loadTop(platform: StreamingPlatform): Promise<TmdbTitle[]> {
  const tv = await getPopularOnProvider('tv', platform.tmdbProviderIds, TOP);
  if (tv.length > 0) return tv;
  return getPopularOnProvider('movie', platform.tmdbProviderIds, TOP);
}

const PopularList: React.FC<{ platform: StreamingPlatform; onSelectTitle: (t: TmdbTitle) => void }> = ({ platform, onSelectTitle }) => {
  const [titles, setTitles] = useState<TmdbTitle[] | null | undefined>(() => peekTop(platform));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (titles !== undefined) return;
    let live = true;
    loadTop(platform)
      .then((t) => live && setTitles(t))
      .catch(() => live && setTitles(null));
    return () => {
      live = false;
    };
  }, [platform, titles, attempt]);

  const kind = titles && titles[0]?.mediaType === 'movie' ? 'movies' : 'shows';
  return (
    <div className="top3-list">
      <div className="top3-heading">
        <TrendingUp size={13} aria-hidden="true" /> Popular {kind} on {platform.name}
      </div>
      {titles === undefined && <div className="muted small">Loading…</div>}
      {titles === null && (
        <div className="muted small">
          Unavailable right now.{' '}
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              setTitles(undefined);
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}
      {titles?.length === 0 && <div className="muted small">No titles listed.</div>}
      {titles?.map((t, idx) => (
        <button key={`${t.mediaType}-${t.id}`} type="button" className="top3-item" onClick={() => onSelectTitle(t)}>
          <span className="top3-left">
            <span className="top3-rank">{idx + 1}</span>
            <span className="top3-name">{t.title}</span>
          </span>
          <span className="muted small">{t.year ?? ''}</span>
        </button>
      ))}
    </div>
  );
};

const PlatformCard: React.FC<{
  platform: StreamingPlatform;
  mine: boolean;
  recentLeads: UpcomingReleaseLead[];
  onSelectTitle: (t: TmdbTitle) => void;
  onToggleService: (id: PlatformId, checked: boolean) => void;
}> = ({ platform, mine, recentLeads, onSelectTitle, onToggleService }) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleId = useId();
  const logo = logoUrl(platform.logoPath);

  return (
    <article className={`platform-card ${open ? 'expanded' : ''} ${mine ? 'is-mine' : ''}`} data-platform={platform.id}>
      <div className="platform-row">
        <button
          id={toggleId}
          type="button"
          className="platform-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          {logo ? (
            <img className="platform-logo" src={logo} alt="" width={36} height={36} loading="lazy" />
          ) : (
            <span className="platform-avatar" style={{ background: platform.brandColor }} aria-hidden="true">
              {platform.shortCode}
            </span>
          )}
          <span className="platform-name">{platform.name}</span>
          <ChevronDown size={16} className={`episodes-chevron ${open ? 'open' : ''}`} aria-hidden="true" />
        </button>
        <label className="my-service-check" title={mine ? 'In My services' : 'Add to My services'}>
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => onToggleService(platform.id, e.target.checked)}
            aria-label={`I have ${platform.name} (My services)`}
          />
          <span className="my-service-box" aria-hidden="true" />
        </label>
      </div>

      {open && (
        <div id={panelId} role="region" aria-labelledby={toggleId} className="platform-panel">
          <PopularList platform={platform} onSelectTitle={onSelectTitle} />
          {recentLeads.length > 0 && (
            <div className="top3-list">
              <div className="top3-heading">Recently released (Upcoming feed)</div>
              {recentLeads.slice(0, 5).map((lead) => (
                <div key={lead.id} className="top3-item static">
                  <span className="top3-name">{lead.showTitle}</span>
                  <span className="muted small">{lead.parsedDateIso ?? lead.extractedDateText ?? ''}</span>
                </div>
              ))}
            </div>
          )}
          {platform.note && (
            <p className="platform-note">
              <Info size={13} aria-hidden="true" /> {platform.note}
            </p>
          )}
          <a href={platform.websiteUrl} target="_blank" rel="noopener noreferrer" className="pill-btn platform-site">
            {platform.name} website (plans and prices) <ExternalLink size={12} aria-hidden="true" />
          </a>
        </div>
      )}
    </article>
  );
};

export const PlatformPage: React.FC<PlatformPageProps> = ({ platforms, availableNowLeads, onSelectTitle, onToggleService }) => {
  const { ids } = useMyServices();
  return (
    <div className="platforms-page">
      <p className="platforms-intro">
        Check the services you have. Discover and the Upcoming filter start with them. Tap a service for what’s popular and a link to its site.
      </p>
      {PLATFORM_GROUPS.map((group) => {
        const list = platforms.filter((p) => p.group === group.id);
        return (
          <section key={group.id} aria-labelledby={`platform-group-${group.id}`}>
            <div className="section-heading">
              <h2 id={`platform-group-${group.id}`}>{group.label}</h2>
            </div>
            <div className="platform-list">
              {list.map((p) => (
                <PlatformCard
                  key={p.id}
                  platform={p}
                  mine={ids.includes(p.id)}
                  recentLeads={availableNowLeads.filter((l) => l.platformId === p.id)}
                  onSelectTitle={onSelectTitle}
                  onToggleService={onToggleService}
                />
              ))}
            </div>
          </section>
        );
      })}
      <p className="fineprint center">Popular titles are ranked by TMDB popularity among titles listed for each service (US). Data by JustWatch, via TMDB.</p>
    </div>
  );
};
