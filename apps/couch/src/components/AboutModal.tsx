import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { SITE } from '../config/site';
import { assetUrl } from '../lib/baseUrl';
import { safeHttpUrl } from '../lib/safeUrl';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
  restoreFocusRef?: React.RefObject<HTMLButtonElement | null>;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const AboutModal: React.FC<AboutModalProps> = ({ open, onClose, restoreFocusRef }) => {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleClose = () => {
    onClose();
    window.requestAnimationFrame(() => {
      restoreFocusRef?.current?.focus();
    });
  };

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusFirst = () => {
      const first = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (closeButtonRef.current ?? first ?? dialog)?.focus();
    };
    const frame = window.requestAnimationFrame(focusFirst);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        window.requestAnimationFrame(() => {
          restoreFocusRef?.current?.focus();
        });
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      if (!restoreFocusRef?.current) {
        previouslyFocused?.focus?.();
      }
    };
  }, [open, onClose, restoreFocusRef]);

  if (!open) return null;

  return (
    <div className="modal-backdrop welcome-backdrop" onClick={handleClose} role="presentation">
      <div
        ref={dialogRef}
        className="modal-sheet welcome-sheet about-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="welcome-header">
          <div>
            <p className="welcome-kicker">About • <a href={SITE.portalUrl} className="portal-link">{SITE.portalName}</a></p>
            <h2 id={titleId} className="welcome-title">
              {SITE.name}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="follow-icon-btn"
            aria-label="Close about"
            onClick={handleClose}
          >
            <X size={16} />
          </button>
        </div>

        <p id={descriptionId} className="welcome-intro">
          {SITE.description}
        </p>

        <p className="about-made-by">
          Made by{' '}
          <a href={safeHttpUrl(SITE.makerUrl) ?? undefined} target="_blank" rel="noopener noreferrer">
            {SITE.makerName}
          </a>
        </p>
        <p className="about-built-with">{SITE.builtWith}</p>
        <p className="about-fineprint about-dev-notice">{SITE.devNotice}</p>

        <p className="about-fineprint">
          Episode and schedule data:{' '}
          <a href={safeHttpUrl(SITE.attribution.sourceUrl) ?? undefined} target="_blank" rel="noopener noreferrer">
            TVmaze
          </a>{' '}
          (
          <a href={safeHttpUrl(SITE.attribution.licenseUrl) ?? undefined} target="_blank" rel="noopener noreferrer">
            CC BY-SA 4.0
          </a>
          )
        </p>
        <div className="about-tmdb">
          <a href={safeHttpUrl(SITE.tmdb.url) ?? undefined} target="_blank" rel="noopener noreferrer" aria-label="TMDB">
            <img src={assetUrl('tmdb-logo.svg')} alt="TMDB" width={64} height={8} />
          </a>
          <p className="about-fineprint">{SITE.tmdb.notice}</p>
        </div>
        <p className="about-fineprint">
          Where-to-watch data by{' '}
          <a href={safeHttpUrl(SITE.justwatchUrl) ?? undefined} target="_blank" rel="noopener noreferrer">
            JustWatch
          </a>
          .
        </p>
        <p className="about-disclaimer">{SITE.disclaimer}</p>

        <div className="welcome-actions">
          <button type="button" className="primary-btn" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
