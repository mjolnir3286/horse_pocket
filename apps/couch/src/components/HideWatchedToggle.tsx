import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface HideWatchedToggleProps {
  hidden: boolean;
  onChange: (hidden: boolean) => void;
}

/** "Watched" eye toggle that lives in the filter row. Eye = shown, crossed-out eye = hidden. */
export const HideWatchedToggle: React.FC<HideWatchedToggleProps> = ({ hidden, onChange }) => {
  const label = hidden ? 'Show watched' : 'Hide watched';
  return (
    <button
      type="button"
      className={`control-btn watched-toggle ${hidden ? 'active' : ''}`}
      aria-label={label}
      title={label}
      onClick={() => onChange(!hidden)}
    >
      {hidden ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
      <span className="control-btn-label">Watched</span>
    </button>
  );
};
