import React, { useEffect, useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, Calendar, ExternalLink, Rss } from 'lucide-react';
import type { CollectorOutput, UpcomingReleaseLead } from '../types/collector';
import type { PlatformId, StreamingPlatform } from '../types/streaming';
import { PlatformFilterMenu } from './PlatformFilterMenu';
import { HideWatchedToggle } from './HideWatchedToggle';
import { WatchlistOnlyToggle } from './WatchlistOnlyToggle';
import { WatchedButton } from './WatchedButton';
import { useMediaQuery } from '../lib/useMediaQuery';
import { useMyServices } from '../services/myServices';
import { compareLeadDates, episodeLine, leadDateDisplay } from '../lib/leadDate';
import {
  isPlatformFilterList,
  isSortKey,
  PLATFORM_STORAGE_KEY,
  readStorage,
  readWatchlistOnly,
  SORT_OPTIONS,
  SORT_STORAGE_KEY,
  writeStorage,
  writeWatchlistOnly,
  type PlatformFilterId,
  type SortKey,
} from '../services/backup';
import { safeHttpUrl } from '../lib/safeUrl';

interface UpcomingViewProps {
  collectorData: CollectorOutput | null;
  platforms: StreamingPlatform[];
  platformsById: Record<PlatformId, StreamingPlatform>;
  isLeadFollowed: (lead: UpcomingReleaseLead) => boolean;
  onToggleFollowLead: (lead: UpcomingReleaseLead) => void;
  isLeadWatched: (lead: UpcomingReleaseLead) => boolean;
  onToggleLeadWatched: (lead: UpcomingReleaseLead) => void;
  onOpenLead: (lead: UpcomingReleaseLead) => void;
  hideWatched: boolean;
  onHideWatchedChange: (hide: boolean) => void;
}

export const UpcomingView: React.FC<UpcomingViewProps> = ({
  collectorData,
  platforms,
  platformsById,
  isLeadFollowed,
  onToggleFollowLead,
  isLeadWatched,
  onToggleLeadWatched,
  onOpenLead,
  hideWatched,
  onHideWatchedChange,
}) => {
  const compactSort = useMediaQuery('(max-width: 520px)');
  const [watchlistOnly, setWatchlistOnly] = useState<boolean>(() => readWatchlistOnly());
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformFilterId[]>(() =>
    readStorage(PLATFORM_STORAGE_KEY, [] as PlatformFilterId[], isPlatformFilterList)
  );
  const [sortKey, setSortKey] = useState<SortKey>(() =>
    readStorage(SORT_STORAGE_KEY, 'date-soonest' as SortKey, isSortKey)
  );

  useEffect(() => {
    writeWatchlistOnly(watchlistOnly);
  }, [watchlistOnly]);

  useEffect(() => {
    writeStorage(PLATFORM_STORAGE_KEY, selectedPlatforms);
  }, [selectedPlatforms]);

  useEffect(() => {
    writeStorage(SORT_STORAGE_KEY, sortKey);
  }, [sortKey]);

  const leads = useMemo(
    () => (collectorData?.leads ?? []).filter((l) => l.availabilityStatus === 'upcoming'),
    [collectorData]
  );

  const statusFilteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (hideWatched && isLeadWatched(lead)) return false;
      if (watchlistOnly && !isLeadFollowed(lead)) return false;
      return true;
    });
  }, [leads, watchlistOnly, isLeadFollowed, hideWatched, isLeadWatched]);

  const platformCounts = useMemo(() => {
    const counts = new Map<PlatformFilterId, number>();
    for (const lead of statusFilteredLeads) {
      const key: PlatformFilterId = lead.platformId === 'unknown' ? 'unknown' : lead.platformId;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [statusFilteredLeads]);

  const { ids: myServices } = useMyServices();
  const hasMine = myServices.length > 0;

  const platformChipOptions = useMemo(() => {
    const options: Array<{ id: PlatformFilterId; name: string; color: string; count: number }> = [];
    // 24 services is a lot for a menu: list the ones with releases here, plus the user's own.
    for (const platform of platforms) {
      const count = platformCounts.get(platform.id) ?? 0;
      if (count === 0 && !myServices.includes(platform.id)) continue;
      options.push({
        id: platform.id,
        name: platform.name,
        color: platform.brandColor,
        count,
      });
    }
    const unknownCount = platformCounts.get('unknown') ?? 0;
    if (unknownCount > 0) {
      options.push({
        id: 'unknown',
        name: 'Other / unspecified',
        color: '#64748b',
        count: unknownCount,
      });
    }
    return options;
  }, [platforms, platformCounts, myServices]);

  // [] follows My services (or All when none are checked); see PlatformFilterId.
  const isDefaultPlatforms = selectedPlatforms.length === 0;
  const isMinePlatforms = isDefaultPlatforms && hasMine;
  const isAllPlatforms = (isDefaultPlatforms && !hasMine) || (selectedPlatforms.length === 1 && selectedPlatforms[0] === 'all');
  const isNonePlatforms = selectedPlatforms.length === 1 && selectedPlatforms[0] === 'none';
  const effectivePlatforms = useMemo<PlatformFilterId[]>(
    () => (isMinePlatforms ? myServices : isAllPlatforms || isNonePlatforms ? [] : selectedPlatforms),
    [isMinePlatforms, isAllPlatforms, isNonePlatforms, myServices, selectedPlatforms]
  );

  const filteredLeads = useMemo(() => {
    const platformMatched = isAllPlatforms
      ? statusFilteredLeads
      : isNonePlatforms
        ? []
        : statusFilteredLeads.filter((lead) => {
            const key: PlatformFilterId = lead.platformId === 'unknown' ? 'unknown' : lead.platformId;
            return effectivePlatforms.includes(key);
          });

    const sorted = [...platformMatched];
    sorted.sort((a, b) => {
      if (sortKey === 'title-az') {
        return a.showTitle.localeCompare(b.showTitle, undefined, { sensitivity: 'base' });
      }
      if (sortKey === 'provider-az') {
        const byName = a.platformName.localeCompare(b.platformName, undefined, { sensitivity: 'base' });
        if (byName !== 0) return byName;
        return a.showTitle.localeCompare(b.showTitle, undefined, { sensitivity: 'base' });
      }
      if (sortKey === 'confidence') {
        return b.confidenceScore - a.confidenceScore;
      }
      return compareLeadDates(a, b, sortKey === 'date-latest');
    });
    return sorted;
  }, [statusFilteredLeads, isAllPlatforms, isNonePlatforms, effectivePlatforms, sortKey]);

  const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));
  const selectAllPlatforms = () => setSelectedPlatforms(hasMine ? ['all'] : []);

  const setPlatformChecked = (id: string, checked: boolean) => {
    const allIds = platformChipOptions.map((option) => option.id);
    const current: PlatformFilterId[] = isAllPlatforms ? allIds : isNonePlatforms ? [] : effectivePlatforms;
    const next = checked
      ? current.includes(id as PlatformFilterId)
        ? current
        : [...current, id as PlatformFilterId]
      : current.filter((item) => item !== id);
    if (next.length === 0) return setSelectedPlatforms(['none']);
    if (allIds.length > 0 && allIds.every((item) => next.includes(item))) return selectAllPlatforms();
    if (hasMine && sameSet(next, myServices)) return setSelectedPlatforms([]);
    setSelectedPlatforms(next);
  };

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
          <Rss size={17} color="var(--accent-bright)" />
          Upcoming Releases
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>
          Updated{' '}
          {new Date(collectorData.generatedAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
      </div>

      <div className="upcoming-controls">
        <PlatformFilterMenu
          options={platformChipOptions}
          selectedIds={effectivePlatforms}
          isAll={isAllPlatforms}
          isNone={isNonePlatforms}
          isMine={isMinePlatforms}
          hasMine={hasMine}
          onToggle={setPlatformChecked}
          onSelectAll={selectAllPlatforms}
          onSelectMine={() => setSelectedPlatforms([])}
          onClear={() => setSelectedPlatforms(['none'])}
        />

        <label className="sort-control">
          <span className="section-meta sort-label">Sort</span>
          <select
            className="sort-select"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            aria-label="Sort upcoming releases"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {compactSort ? option.shortLabel : option.label}
              </option>
            ))}
          </select>
        </label>

        <HideWatchedToggle hidden={hideWatched} onChange={onHideWatchedChange} />
        <WatchlistOnlyToggle on={watchlistOnly} onChange={setWatchlistOnly} />
      </div>

      <div className="section-meta" style={{ marginBottom: 10 }}>
        {filteredLeads.length} shown
        {isMinePlatforms
          ? ' • My services'
          : !isAllPlatforms && !isNonePlatforms && ` • ${effectivePlatforms.length} platform${effectivePlatforms.length === 1 ? '' : 's'} selected`}
      </div>

      {filteredLeads.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
          No upcoming releases match the current filters. Try Platforms: All, or turn off Watchlist only.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredLeads.map((lead) => {
            const followed = isLeadFollowed(lead);
            const watched = isLeadWatched(lead);
            const platform = lead.platformId !== 'unknown' ? platformsById[lead.platformId] : null;
            const date = leadDateDisplay(lead);
            const episode = episodeLine(lead);

            return (
              <article key={lead.id} className={`panel lead-card ${watched ? 'is-watched' : ''}`} style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      {followed && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: 'var(--accent-bright)',
                          }}
                        >
                          ★ Watchlisted
                        </span>
                      )}

                      {watched && <span className="watched-tag tiny">✓ Watched</span>}
                    </div>

                    <h3 style={{ margin: '7px 0 4px', fontSize: '0.98rem' }}>
                      {lead.tvmaze?.showId != null ? (
                        <button type="button" className="lead-title-btn" onClick={() => onOpenLead(lead)}>
                          {lead.showTitle}
                        </button>
                      ) : (
                        lead.showTitle
                      )}
                    </h3>
                  </div>

                  <div className="card-actions">
                  <WatchedButton watched={watched} title={lead.showTitle} onToggle={() => onToggleLeadWatched(lead)} />

                  <button
                    type="button"
                    className={`follow-icon-btn ${followed ? 'following' : ''}`}
                    aria-label={followed ? `Remove ${lead.showTitle} from Watchlist` : `Add ${lead.showTitle} to Watchlist`}
                    title={followed ? 'In your Watchlist' : 'Add to Watchlist'}
                    onClick={() => onToggleFollowLead(lead)}
                  >
                    {followed ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                  </button>
                  </div>
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

                  <span className="lead-date">
                    <Calendar size={13} color="var(--accent-bright)" aria-hidden="true" />
                    {date.dateText && <span>{date.dateText}</span>}
                    {date.unconfirmed && <span className="lead-unconfirmed">Unconfirmed</span>}
                  </span>
                </div>

                {episode && <div className="lead-episode">{episode}</div>}

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lead.rawHeadline}</div>

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
                  {safeHttpUrl(lead.sourceUrl) && (
                    <a
                      href={safeHttpUrl(lead.sourceUrl) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
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
      )}
    </div>
  );
};
