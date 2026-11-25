import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Bookmark,
  BellRing,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileDown,
  FileUp,
  Film,
  Layers,
  Rss,
  Sparkles,
  X,
} from 'lucide-react';
import { SITE } from '../config/site';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
  restoreFocusRef?: React.RefObject<HTMLButtonElement | null>;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const TABS: { icon: React.ReactNode; label: string; text: string }[] = [
  {
    icon: <Rss size={16} aria-hidden="true" />,
    label: 'Upcoming',
    text: 'Browse new releases, then filter by platform or date.',
  },
  {
    icon: <Film size={16} aria-hidden="true" />,
    label: 'Discover',
    text: 'Search a title to see where it streams, plays free, or is for rent or purchase in the US.',
  },
  {
    icon: <Bookmark size={16} aria-hidden="true" />,
    label: 'Watchlist',
    text: 'Titles you’ve saved. Couch checks for new episodes when you open this tab.',
  },
  {
    icon: <Layers size={16} aria-hidden="true" />,
    label: 'Platforms',
    text: 'Compare hand-checked plan prices and what’s popular on each service.',
  },
];

const TIPS: { icon: React.ReactNode; label: string; text: string }[] = [
  {
    icon: <Check size={16} aria-hidden="true" />,
    label: 'Watched',
    text: 'Tap the check on a title to mark it watched. For a show, that marks every aired episode and adds it to your Watchlist. Marking one episode only affects that episode.',
  },
  {
    icon: <BellRing size={16} aria-hidden="true" />,
    label: 'New episodes',
    text: 'A watched mark means you’re caught up as of then. New episodes show as unwatched, and Hide watched leaves them visible.',
  },
  {
    icon: <Eye size={16} aria-hidden="true" />,
    label: 'Hide watched',
    text: 'The eye next to Platforms and Sort hides titles you’re caught up on, in both Upcoming and Discover.',
  },
  {
    icon: <CheckCircle2 size={16} aria-hidden="true" />,
    label: 'Filters',
    text: 'Confirmed means Couch matched an episode date on TVmaze. Watchlisted shows only your saved titles.',
  },
  {
    icon: <Sparkles size={16} aria-hidden="true" />,
    label: 'Watch Next',
    text: 'Tap the heading on the Watchlist tab for suggestions based on what you’ve watched. They refresh about once a day.',
  },
  {
    icon: (
      <span className="help-season-mark" aria-hidden="true">
        S1
      </span>
    ),
    label: 'Seasons',
    text: 'Open a show to see each season’s episodes and where it streams.',
  },
  {
    icon: (
      <span className="help-backup-icons" aria-hidden="true">
        <FileDown size={14} aria-hidden="true" />
        <FileUp size={14} aria-hidden="true" />
      </span>
    ),
    label: 'Back up',
    text: 'In the menu under Your Data, Export saves a file and Import restores it, replacing what’s saved now.',
  },
  {
    icon: <Download size={16} aria-hidden="true" />,
    label: 'Install',
    text: 'Use Install in the header or the menu, or your browser’s “Add to Home screen” option.',
  },
];

export const HelpModal: React.FC<HelpModalProps> = ({ open, onClose, restoreFocusRef }) => {
  const titleId = useId();
  const descriptionId = useId();
  const tabsId = useId();
  const tipsId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [tabsOpen, setTabsOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);

  const handleClose = () => {
    onClose();
    window.requestAnimationFrame(() => {
      restoreFocusRef?.current?.focus();
    });
  };

  useEffect(() => {
    if (open) {
      setTabsOpen(false);
      setTipsOpen(false);
    }
  }, [open]);

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
        className="modal-sheet welcome-sheet help-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="welcome-header">
          <div>
            <p className="welcome-kicker">Help</p>
            <h2 id={titleId} className="welcome-title">
              {SITE.name}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="follow-icon-btn"
            aria-label="Close help"
            onClick={handleClose}
          >
            <X size={16} />
          </button>
        </div>

        <p id={descriptionId} className="welcome-intro">
          Couch helps you find where to watch and keep up with new episodes. Everything is saved on this device only.
        </p>

        <div className="help-accordion">
          <section className="help-section">
            <button
              type="button"
              className="help-section-toggle"
              aria-expanded={tabsOpen}
              aria-controls={tabsId}
              onClick={() => setTabsOpen((prev) => !prev)}
            >
              <span>Tabs</span>
              <ChevronDown size={18} className={`help-chevron${tabsOpen ? ' is-open' : ''}`} aria-hidden="true" />
            </button>
            <div id={tabsId} role="region" hidden={!tabsOpen} className="help-section-body">
              <ul className="help-list">
                {TABS.map((item) => (
                  <li key={item.label}>
                    <span className="help-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="help-section">
            <button
              type="button"
              className="help-section-toggle"
              aria-expanded={tipsOpen}
              aria-controls={tipsId}
              onClick={() => setTipsOpen((prev) => !prev)}
            >
              <span>Tips</span>
              <ChevronDown size={18} className={`help-chevron${tipsOpen ? ' is-open' : ''}`} aria-hidden="true" />
            </button>
            <div id={tipsId} role="region" hidden={!tipsOpen} className="help-section-body">
              <ul className="help-list">
                {TIPS.map((item) => (
                  <li key={item.label}>
                    <span className="help-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <div className="welcome-actions">
          <button type="button" className="primary-btn" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
