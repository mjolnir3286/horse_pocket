import React from 'react';
import { Check } from 'lucide-react';

interface WatchedButtonProps {
  watched: boolean;
  title: string;
  onToggle: () => void;
  /** Small "3/10" style progress for partly watched shows. */
  partial?: string | null;
  busy?: boolean;
  className?: string;
}

/** Round check toggle that sits beside the Watchlist bookmark on cards and rows. */
export const WatchedButton: React.FC<WatchedButtonProps> = ({ watched, title, onToggle, partial, busy, className }) => (
  <button
    type="button"
    className={`follow-icon-btn watched-btn ${watched ? 'is-watched' : ''} ${partial && !watched ? 'is-partial' : ''}${className ? ` ${className}` : ''}`}
    aria-pressed={watched}
    aria-label={watched ? `Mark ${title} as not watched` : `Mark ${title} as watched`}
    title={watched ? 'Watched' : partial ? `Partly watched (${partial})` : 'Mark watched'}
    disabled={busy}
    onClick={(e) => {
      e.stopPropagation();
      onToggle();
    }}
  >
    <Check size={15} strokeWidth={watched ? 3 : 2} />
  </button>
);
