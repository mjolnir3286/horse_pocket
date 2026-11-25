import React, { useId, useRef } from 'react';
import { X } from 'lucide-react';
import { SITE } from '../config/site';
import { useFocusTrap } from '../lib/useFocusTrap';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
  restoreFocusRef?: React.RefObject<HTMLElement | null>;
}

export const AboutModal: React.FC<AboutModalProps> = ({ open, onClose, restoreFocusRef }) => {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(open, dialogRef, onClose, closeRef, restoreFocusRef);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="modal-sheet about-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-header">
          <div>
            <p className="sheet-kicker">
              About • <a href={SITE.portalUrl} className="portal-link">{SITE.portalName}</a>
            </p>
            <h2 id={titleId} className="sheet-title">
              {SITE.name}
            </h2>
          </div>
          <button ref={closeRef} type="button" className="secondary-btn icon-btn" aria-label="Close about" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <p id={descId} className="sheet-intro">
          {SITE.description}
        </p>
        <p className="about-made-by">
          Made by{' '}
          <a href={SITE.makerUrl} target="_blank" rel="noopener noreferrer">
            {SITE.makerName}
          </a>
        </p>
        <p className="about-built-with">{SITE.builtWith}</p>
        <p className="about-fineprint">{SITE.devNotice}</p>
        <p className="about-fineprint">
          {SITE.credits.map((c, i) => (
            <React.Fragment key={c.url}>
              {i > 0 && ' · '}
              <a href={c.url} target="_blank" rel="noopener noreferrer">
                {c.text}
              </a>
            </React.Fragment>
          ))}
          <br />
          {SITE.formulaNote}
        </p>
        <p className="about-disclaimer">{SITE.disclaimer}</p>
        <div className="sheet-actions">
          <button type="button" className="primary-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
