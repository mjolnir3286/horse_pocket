import React from 'react';
import { Check } from 'lucide-react';
import { useMyServices } from '../services/myServices';
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

/** Services in My services first, keeping TMDB's order otherwise. */
function mineFirst(list: ProviderOption[], mine: Set<number>): ProviderOption[] {
  if (mine.size === 0) return list;
  return [...list.filter((p) => mine.has(p.id)), ...list.filter((p) => !mine.has(p.id))];
}

const ProviderChip: React.FC<{ p: ProviderOption; compact?: boolean; owned?: boolean }> = ({ p, compact, owned }) => {
  const logo = logoUrl(p.logoPath);
  const label = owned ? `${p.name} (you have this)` : p.name;
  const logoOnly = compact && logo;
  return (
    <span className={`provider-chip ${compact ? 'compact' : ''} ${owned ? 'owned' : ''}`} title={label}>
      {logo ? <img src={logo} alt={logoOnly ? label : ''} loading="lazy" width={20} height={20} /> : null}
      {!logoOnly && <span>{p.name}</span>}
      {owned && !logoOnly && <span className="sr-only"> (you have this)</span>}
      {owned && (
        <span className="owned-mark" aria-hidden="true">
          <Check size={9} strokeWidth={3.5} />
        </span>
      )}
    </span>
  );
};

/** Compact summary for result cards: stream logos first, then which other ways exist. */
export const WatchOptionsSummary: React.FC<{ options: WatchOptions | null | undefined }> = ({ options }) => {
  const { providerIds: mine } = useMyServices();
  if (options === undefined) return <div className="watch-summary muted">Checking where to watch…</div>;
  if (options === null) return <div className="watch-summary muted">Where-to-watch unavailable right now</div>;
  if (!hasAnyOption(options)) return <div className="watch-summary muted">Not streaming in the US right now</div>;
  const freeish = mineFirst([...options.free, ...options.ads], mine);
  const extra: string[] = [];
  if (options.rent.length) extra.push('Rent');
  if (options.buy.length) extra.push('Buy');
  return (
    <div className="watch-summary">
      {mineFirst(options.stream, mine).slice(0, 5).map((p) => (
        <ProviderChip key={`s-${p.id}`} p={p} compact owned={mine.has(p.id)} />
      ))}
      {freeish.slice(0, 3).map((p) => (
        <ProviderChip key={`f-${p.id}`} p={p} compact owned={mine.has(p.id)} />
      ))}
      {freeish.length > 0 && <span className="access-tag">Free</span>}
      {extra.length > 0 && <span className="access-tag">{extra.join(' / ')}</span>}
    </div>
  );
};

/** Full grouped list for the details sheet. */
export const WatchOptionsFull: React.FC<{ options: WatchOptions | null | undefined }> = ({ options }) => {
  const { providerIds: mine } = useMyServices();
  if (options === undefined) return <p className="muted small">Checking where to watch…</p>;
  if (options === null) return <p className="muted small">Where-to-watch is unavailable right now. Try again in a bit.</p>;
  if (!hasAnyOption(options)) return <p className="muted small">No US streaming, rental, or purchase options listed right now.</p>;
  return (
    <div className="watch-groups">
      {GROUPS.filter((g) => options[g.key].length > 0).map((g) => (
        <div key={g.key} className="watch-group">
          <div className="watch-group-label">{g.label}</div>
          <div className="watch-group-chips">
            {mineFirst(options[g.key], mine).map((p) => (
              <ProviderChip key={`${g.key}-${p.id}`} p={p} owned={mine.has(p.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
