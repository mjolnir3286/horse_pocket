import React from 'react';
import { logoUrl, type ProviderOption, type WatchOptions } from '../services/tmdb';

const GROUPS: Array<{ key: keyof Omit<WatchOptions, 'link'>; label: string }> = [
  { key: 'stream', label: 'Stream' },
  { key: 'free', label: 'Free' },
  { key: 'ads', label: 'Free with ads' },
  { key: 'rent', label: 'Rent' },
  { key: 'buy', label: 'Buy' },
];

export function hasAnyOption(o: WatchOptions): boolean {
  return GROUPS.some((g) => o[g.key].length > 0);
}

const ProviderChip: React.FC<{ p: ProviderOption; compact?: boolean }> = ({ p, compact }) => {
  const logo = logoUrl(p.logoPath);
  return (
    <span className={`provider-chip ${compact ? 'compact' : ''}`} title={p.name}>
      {logo ? <img src={logo} alt="" loading="lazy" width={20} height={20} /> : null}
      {!compact && <span>{p.name}</span>}
      {compact && !logo && <span>{p.name}</span>}
    </span>
  );
};

/** Compact summary for result cards: stream logos first, then which other ways exist. */
export const WatchOptionsSummary: React.FC<{ options: WatchOptions | null | undefined }> = ({ options }) => {
  if (options === undefined) return <div className="watch-summary muted">Checking where to watch…</div>;
  if (options === null) return <div className="watch-summary muted">Where-to-watch unavailable right now</div>;
  if (!hasAnyOption(options)) return <div className="watch-summary muted">Not streaming in the US right now</div>;
  const freeish = [...options.free, ...options.ads];
  const extra: string[] = [];
  if (options.rent.length) extra.push('Rent');
  if (options.buy.length) extra.push('Buy');
  return (
    <div className="watch-summary">
      {options.stream.slice(0, 5).map((p) => (
        <ProviderChip key={`s-${p.id}`} p={p} compact />
      ))}
      {freeish.slice(0, 3).map((p) => (
        <ProviderChip key={`f-${p.id}`} p={p} compact />
      ))}
      {freeish.length > 0 && <span className="access-tag">Free</span>}
      {extra.length > 0 && <span className="access-tag">{extra.join(' / ')}</span>}
    </div>
  );
};

/** Full grouped list for the details sheet. */
export const WatchOptionsFull: React.FC<{ options: WatchOptions | null | undefined }> = ({ options }) => {
  if (options === undefined) return <p className="muted small">Checking where to watch…</p>;
  if (options === null) return <p className="muted small">Where-to-watch is unavailable right now. Try again in a bit.</p>;
  if (!hasAnyOption(options)) return <p className="muted small">No US streaming, rental, or purchase options listed right now.</p>;
  return (
    <div className="watch-groups">
      {GROUPS.filter((g) => options[g.key].length > 0).map((g) => (
        <div key={g.key} className="watch-group">
          <div className="watch-group-label">{g.label}</div>
          <div className="watch-group-chips">
            {options[g.key].map((p) => (
              <ProviderChip key={`${g.key}-${p.id}`} p={p} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
