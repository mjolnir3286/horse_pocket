import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Layers, TrendingUp } from 'lucide-react';
import { PLATFORMS } from '../data/platforms';
import { useMyServices } from '../services/myServices';
import {
  getServiceRow,
  getTrendingRow,
  logoUrl,
  peekServiceRow,
  peekTrendingRow,
  type RowType,
  type TmdbTitle,
} from '../services/tmdb';
import type { StreamingPlatform } from '../types/streaming';
import { PosterCard } from './PosterCard';

interface DiscoverHomeProps {
  type: RowType;
  isHidden: (t: TmdbTitle) => boolean;
  isFollowed: (t: TmdbTitle) => boolean;
  onToggleFollow: (t: TmdbTitle) => void;
  onSelect: (t: TmdbTitle) => void;
  onOpenPlatforms: () => void;
}

/** Load when the row is near the viewport, so a long list of services stays light on data. */
function useNearViewport<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (near) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return [ref, near];
}

interface RowProps extends Omit<DiscoverHomeProps, 'onOpenPlatforms' | 'type'> {
  id: string;
  heading: React.ReactNode;
  label: string;
  peek: () => TmdbTitle[] | undefined;
  fetchRow: () => Promise<TmdbTitle[]>;
  emptyText: string;
}

const TitleRowSection: React.FC<RowProps> = ({ id, heading, label, peek, fetchRow, emptyText, isHidden, isFollowed, onToggleFollow, onSelect }) => {
  const [ref, near] = useNearViewport<HTMLElement>();
  const [titles, setTitles] = useState<TmdbTitle[] | null | undefined>(() => peek());
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    const cached = peek();
    if (cached) {
      setTitles(cached);
      return;
    }
    setLoading(true);
    fetchRow()
      .then(setTitles)
      .catch(() => setTitles(null))
      .finally(() => setLoading(false));
  }, [peek, fetchRow]);

  // Reload when the row's query changes (All / Shows / Movies).
  useEffect(() => {
    setTitles(peek());
  }, [peek]);

  useEffect(() => {
    if (near && titles === undefined && !loading) load();
  }, [near, titles, loading, load]);

  const visible = titles ? titles.filter((t) => !isHidden(t)) : [];
  const headingId = `discover-row-${id}`;

  return (
    <section ref={ref} className="discover-row" aria-labelledby={headingId} data-row={id}>
      <h3 id={headingId} className="discover-row-heading">
        {heading}
      </h3>
      {titles === null ? (
        <div className="muted small discover-row-status">
          Unavailable right now.{' '}
          <button type="button" className="text-btn" onClick={load}>
            Try again
          </button>
        </div>
      ) : titles === undefined ? (
        <div className="title-row" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="watch-next-card skeleton-card">
              <div className="watch-next-poster skeleton" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="muted small discover-row-status">{titles.length > 0 ? 'Everything here is marked watched.' : emptyText}</div>
      ) : (
        <div className="title-row" role="list" aria-label={label}>
          {visible.map((t) => (
            <PosterCard key={`${t.mediaType}-${t.id}`} title={t} followed={isFollowed(t)} onSelect={onSelect} onToggleFollow={onToggleFollow} />
          ))}
        </div>
      )}
    </section>
  );
};

const ServiceHeading: React.FC<{ platform: StreamingPlatform }> = ({ platform }) => {
  const logo = logoUrl(platform.logoPath);
  return (
    <>
      {logo ? <img className="row-logo" src={logo} alt="" width={20} height={20} loading="lazy" /> : null}
      Popular on {platform.name}
    </>
  );
};

/** Discover with an empty search: a row per My service, or Trending when none are picked. */
export const DiscoverHome: React.FC<DiscoverHomeProps> = ({ type, onOpenPlatforms, ...rowProps }) => {
  const { ids } = useMyServices();
  const mine = PLATFORMS.filter((p) => ids.includes(p.id));
  const typeWord = type === 'tv' ? 'shows' : type === 'movie' ? 'movies' : 'titles';

  const trendingPeek = useCallback(() => peekTrendingRow(type), [type]);
  const trendingFetch = useCallback(() => getTrendingRow(type), [type]);

  if (mine.length === 0) {
    return (
      <div className="discover-home">
        <TitleRowSection
          {...rowProps}
          id={`trending-${type}`}
          heading={
            <>
              <TrendingUp size={16} aria-hidden="true" /> Trending this week
            </>
          }
          label={`Trending ${typeWord} this week`}
          peek={trendingPeek}
          fetchRow={trendingFetch}
          emptyText="Nothing trending right now."
        />
        <p className="discover-hint">
          <Layers size={14} aria-hidden="true" />
          <span>
            See what’s popular on the services you have.{' '}
            <button type="button" className="text-btn" onClick={onOpenPlatforms}>
              Pick your services
            </button>
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="discover-home">
      {mine.map((p) => (
        <ServiceRow key={`${p.id}-${type}`} platform={p} type={type} typeWord={typeWord} rowProps={rowProps} />
      ))}
      <p className="discover-hint">
        <Layers size={14} aria-hidden="true" />
        <span>
          Rows follow your services.{' '}
          <button type="button" className="text-btn" onClick={onOpenPlatforms}>
            Change services
          </button>
        </span>
      </p>
    </div>
  );
};

const ServiceRow: React.FC<{
  platform: StreamingPlatform;
  type: RowType;
  typeWord: string;
  rowProps: Omit<DiscoverHomeProps, 'onOpenPlatforms' | 'type'>;
}> = ({ platform, type, typeWord, rowProps }) => {
  const peek = useCallback(() => peekServiceRow(type, platform.tmdbProviderIds), [type, platform]);
  const fetchRow = useCallback(() => getServiceRow(type, platform.tmdbProviderIds), [type, platform]);
  return (
    <TitleRowSection
      {...rowProps}
      id={`${platform.id}-${type}`}
      heading={<ServiceHeading platform={platform} />}
      label={`Popular ${typeWord} on ${platform.name}`}
      peek={peek}
      fetchRow={fetchRow}
      emptyText={`No popular ${typeWord} listed for ${platform.name} right now.`}
    />
  );
};
