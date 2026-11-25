import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Rss,
} from 'lucide-react';
import type { CollectorOutput, UpcomingReleaseLead } from '../types/collector';
import type { PlatformId, StreamingPlatform } from '../types/streaming';
import { PlatformFilterMenu } from './PlatformFilterMenu';
import { HideWatchedToggle } from './HideWatchedToggle';
import { WatchedButton } from './WatchedButton';
import { useMediaQuery } from '../lib/useMediaQuery';
import {
  isPlatformFilterList,
  isSortKey,
  isStatusFilter,
  PLATFORM_STORAGE_KEY,
  readStorage,
  SORT_OPTIONS,
  SORT_STORAGE_KEY,
  STATUS_STORAGE_KEY,
  writeStorage,
  type PlatformFilterId,
  type SortKey,
  type StatusFilter,
} from '../services/backup';

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

function leadSortDate(lead: UpcomingReleaseLead): string | null {
  return lead.parsedDateIso || null;
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
  const [filter, setFilter] = useState<StatusFilter>(() =>
    readStorage(STATUS_STORAGE_KEY, 'all' as StatusFilter, isStatusFilter)
  );
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformFilterId[]>(() =>
    readStorage(PLATFORM_STORAGE_KEY, [] as PlatformFilterId[], isPlatformFilterList)
  );
  const [sortKey, setSortKey] = useState<SortKey>(() =>
    readStorage(SORT_STORAGE_KEY, 'date-soonest' as SortKey, isSortKey)
  );

  useEffect(() => {
    writeStorage(STATUS_STORAGE_KEY, filter);
  }, [filter]);

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

  const followedLeadsCount = useMemo(
    () => leads.filter((l) => isLeadFollowed(l)).length,
    [leads, isLeadFollowed]
  );

  const statusFilteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (hideWatched && isLeadWatched(lead)) return false;
      if (filter === 'confirmed') return lead.confirmationStatus === 'confirmed';
      if (filter === 'unconfirmed') return lead.confirmationStatus === 'unconfirmed';
      if (filter === 'followed') return isLeadFollowed(lead);
      return true;
    });
  }, [leads, filter, isLeadFollowed, hideWatched, isLeadWatched]);

  const platformCounts = useMemo(() => {
    const counts = new Map<PlatformFilterId, number>();
    for (const lead of statusFilteredLeads) {
      const key: PlatformFilterId = lead.platformId === 'unknown' ? 'unknown' : lead.platformId;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [statusFilteredLeads]);

  const platformChipOptions = useMemo(() => {
    const options: Array<{ id: PlatformFilterId; name: string; color: string; count: number }> = [];
    const priority = platforms.filter((p) => p.tier === 'priority');
    const secondary = platforms.filter((p) => p.tier === 'secondary');
    for (const platform of [...priority, ...secondary]) {
      options.push({
        id: platform.id,
        name: platform.name,
        color: platform.brandColor,
        count: platformCounts.get(platform.id) ?? 0,
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
  }, [platforms, platformCounts]);

  const isAllPlatforms = selectedPlatforms.length === 0;
  const isNonePlatforms = selectedPlatforms.length === 1 && selectedPlatforms[0] === 'none';

  const filteredLeads = useMemo(() => {
    const platformMatched = isAllPlatforms
      ? statusFilteredLeads
      : isNonePlatforms
        ? []
        : statusFilteredLeads.filter((lead) => {
            const key: PlatformFilterId = lead.platformId === 'unknown' ? 'unknown' : lead.platformId;
            return selectedPlatforms.includes(key);
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
      const aDate = leadSortDate(a);
      const bDate = leadSortDate(b);
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      const cmp = aDate.localeCompare(bDate);
      return sortKey === 'date-latest' ? -cmp : cmp;
    });
    return sorted;
  }, [statusFilteredLeads, isAllPlatforms, isNonePlatforms, selectedPlatforms, sortKey]);

  const setPlatformChecked = (id: string, checked: boolean) => {
    const allIds = platformChipOptions.map((option) => option.id);
    setSelectedPlatforms((prev) => {
      const isAll = prev.length === 0;
      const isNone = prev.length === 1 && prev[0] === 'none';
      const current: PlatformFilterId[] = isAll ? allIds : isNone ? [] : prev.filter((item) => item !== 'none');
      const next = checked
        ? current.includes(id as PlatformFilterId)
          ? current
          : [...current, id as PlatformFilterId]
        : current.filter((item) => item !== id);
      if (next.length === 0) return ['none'];
      if (allIds.length > 0 && allIds.every((item) => next.includes(item))) return [];
      return next;
    });
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

      <div className="chip-row" role="group" aria-label="Filter by confirmation status">
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
            ['followed', `Watchlisted (${followedLeadsCount})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`filter-chip ${filter === key ? 'active' : ''}`}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="upcoming-controls">
        <PlatformFilterMenu
          options={platformChipOptions}
          selectedIds={isNonePlatforms ? [] : selectedPlatforms}
          isAll={isAllPlatforms}
          isNone={isNonePlatforms}
          onToggle={setPlatformChecked}
          onSelectAll={() => setSelectedPlatforms([])}
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
      </div>

      <div className="section-meta" style={{ marginBottom: 10 }}>
        {filteredLeads.length} shown
        {!isAllPlatforms && !isNonePlatforms && ` • ${selectedPlatforms.length} platform${selectedPlatforms.length === 1 ? '' : 's'} selected`}
      </div>

      {filteredLeads.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
          No upcoming releases match the current filters. Try Platforms: All or another status.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredLeads.map((lead) => {
            const isConfirmed = lead.confirmationStatus === 'confirmed';
            const followed = isLeadFollowed(lead);
            const watched = isLeadWatched(lead);
            const platform = lead.platformId !== 'unknown' ? platformsById[lead.platformId] : null;
            const dateLabel = lead.parsedDateIso
              ? `${lead.parsedDateIso} (${lead.datePrecision})`
              : lead.extractedDateText
                ? `${lead.extractedDateText} (${lead.datePrecision})`
                : 'Date unclear';

            return (
              <article key={lead.id} className={`panel lead-card ${watched ? 'is-watched' : ''}`} style={{ marginBottom: 0 }}>
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
      )}
    </div>
  );
};
