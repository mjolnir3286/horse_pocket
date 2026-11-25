import React from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';

interface WatchlistOnlyToggleProps {
  on: boolean;
  onChange: (on: boolean) => void;
}

/** Bookmark toggle that lives in the Upcoming filter row, matching the eye toggle. */
export const WatchlistOnlyToggle: React.FC<WatchlistOnlyToggleProps> = ({ on, onChange }) => {
  const label = 'Watchlist only';
  return (
    <button
      type="button"
      className={`control-btn watchlist-only-toggle ${on ? 'active' : ''}`}
      aria-label={label}
      aria-pressed={on}
      title={label}
      onClick={() => onChange(!on)}
    >
      {on ? <BookmarkCheck size={15} aria-hidden="true" /> : <Bookmark size={15} aria-hidden="true" />}
      <span className="control-btn-label">Watchlist only</span>
    </button>
  );
};
