import React, { useEffect, useId, useRef, useState } from 'react';
import { Bell, BellRing, Clapperboard, Layers, Search, X } from 'lucide-react';
import { SITE } from '../config/site';
import type { NotificationSupportState } from '../services/notifications';

export const WELCOME_DISMISSED_KEY = 'horse_pocket_welcome_dismissed_v1';

export function readWelcomeDismissed(): boolean {
  try {
    return localStorage.getItem(WELCOME_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeWelcomeDismissed(dismissed: boolean) {
  try {
    if (dismissed) {
      localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
    } else {
      localStorage.removeItem(WELCOME_DISMISSED_KEY);
    }
  } catch {
    // Fail open: if storage is blocked, the card will show again next visit.
  }
}

interface WelcomeModalProps {
  open: boolean;
  permissionState: NotificationSupportState;
  onClose: () => void;
  onRequestNotifications: () => void;
  restoreFocusRef?: React.RefObject<HTMLButtonElement | null>;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  open,
  permissionState,
  onClose,
  onRequestNotifications,
  restoreFocusRef,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [dontShowAgain, setDontShowAgain] = useState(true);
  const dontShowAgainRef = useRef(dontShowAgain);

  useEffect(() => {
    dontShowAgainRef.current = dontShowAgain;
  }, [dontShowAgain]);

  useEffect(() => {
    if (open) {
      setDontShowAgain(true);
      dontShowAgainRef.current = true;
    }
  }, [open]);

  const handleClose = () => {
    writeWelcomeDismissed(dontShowAgainRef.current);
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
        writeWelcomeDismissed(dontShowAgainRef.current);
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

  const notificationsEnabled = permissionState === 'granted';

  return (
    <div
      className="modal-backdrop welcome-backdrop"
      onClick={handleClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="modal-sheet welcome-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="welcome-header">
          <div>
            <p className="welcome-kicker">Welcome to</p>
            <h2 id={titleId} className="welcome-title">
              {SITE.name}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="follow-icon-btn"
            aria-label="Close welcome"
            onClick={handleClose}
          >
            <X size={16} />
          </button>
        </div>

        <p id={descriptionId} className="welcome-intro">
          A few things you can do here, all from one place:
        </p>

        <ul className="welcome-features">
          <li>
            <span className="welcome-icon" aria-hidden="true">
              <Clapperboard size={16} />
            </span>
            <div>
              <strong>Upcoming</strong>
              <p>Browse new releases, then filter or sort by platform and date.</p>
            </div>
          </li>
          <li>
            <span className="welcome-icon" aria-hidden="true">
              <Search size={16} />
            </span>
            <div>
              <strong>Discover</strong>
              <p>Type a title and press Search to see where it streams, plays free, or rents in the US.</p>
            </div>
          </li>
          <li>
            <span className="welcome-icon" aria-hidden="true">
              <BellRing size={16} />
            </span>
            <div>
              <strong>Watchlist</strong>
              <p>Add a show to your Watchlist and Couch lets you know about new episodes when you open it.</p>
            </div>
          </li>
          <li>
            <span className="welcome-icon" aria-hidden="true">
              <Layers size={16} />
            </span>
            <div>
              <strong>Platforms</strong>
              <p>Compare hand-checked plan prices and what’s popular on each platform.</p>
            </div>
          </li>
        </ul>

        <label className="welcome-checkbox">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(event) => setDontShowAgain(event.target.checked)}
          />
          Don’t show this again
        </label>
        <p className="welcome-hint">
          {dontShowAgain
            ? `Checked: this card won’t appear the next time you open ${SITE.name}. You can still open Help from the menu.`
            : 'Unchecked: this card will appear again on your next visit.'}
        </p>

        <div className="welcome-actions">
          <button type="button" className="primary-btn" onClick={handleClose}>
            Get started
          </button>
          {!notificationsEnabled && permissionState !== 'unsupported' && (
            <button type="button" className="secondary-btn" onClick={onRequestNotifications}>
              <Bell size={15} /> Enable notifications
            </button>
          )}
          {notificationsEnabled && (
            <span className="welcome-enabled">Notifications are on</span>
          )}
        </div>
      </div>
    </div>
  );
};
