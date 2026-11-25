import React, { useEffect, useId, useRef, useState } from 'react';
import {
  ChevronLeft,
  CircleHelp,
  Download,
  FileDown,
  FileUp,
  Info,
  X,
} from 'lucide-react';
import { SITE } from '../config/site';

export interface PendingCouchImport {
  summary: string;
  apply: () => void;
}

interface SideMenuProps {
  id: string;
  open: boolean;
  onClose: () => void;
  restoreFocusRef: React.RefObject<HTMLButtonElement | null>;
  onOpenHelp: () => void;
  onOpenAbout: () => void;
  onExport: () => void;
  onValidateImport: (
    rawText: string
  ) => { ok: true; pending: PendingCouchImport } | { ok: false; error: string };
  onInstall: () => void;
  brandIcon: React.ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input:not([disabled]):not([type="file"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const SideMenu: React.FC<SideMenuProps> = ({
  id,
  open,
  onClose,
  restoreFocusRef,
  onOpenHelp,
  onOpenAbout,
  onExport,
  onValidateImport,
  onInstall,
  brandIcon,
}) => {
  const titleId = useId();
  const dataHeadingId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const importButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingImport, setPendingImport] = useState<PendingCouchImport | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [dataStatus, setDataStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPendingImport(null);
      setDataError(null);
      setDataStatus(null);
    }
  }, [open]);

  const handleCloseWithRestore = () => {
    onClose();
    window.requestAnimationFrame(() => {
      restoreFocusRef.current?.focus();
    });
  };

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        window.requestAnimationFrame(() => {
          restoreFocusRef.current?.focus();
        });
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose, restoreFocusRef]);

  useEffect(() => {
    if (pendingImport) {
      window.requestAnimationFrame(() => {
        confirmButtonRef.current?.focus();
      });
    }
  }, [pendingImport]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setDataError(null);
    setDataStatus(null);

    try {
      const text = await file.text();
      const res = onValidateImport(text);
      if (!res.ok) {
        setPendingImport(null);
        setDataError(res.error);
        return;
      }
      setPendingImport(res.pending);
    } catch {
      setPendingImport(null);
      setDataError('Could not read that file. Please try another Couch backup (.json).');
    }
  };

  const handleConfirmImport = () => {
    if (!pendingImport) return;
    pendingImport.apply();
    setPendingImport(null);
    setDataError(null);
    setDataStatus('Imported backup. Your lists have been replaced.');
    window.requestAnimationFrame(() => {
      importButtonRef.current?.focus();
    });
  };

  const handleCancelImport = () => {
    setPendingImport(null);
    window.requestAnimationFrame(() => {
      importButtonRef.current?.focus();
    });
  };

  const handleExportClick = () => {
    setDataError(null);
    setPendingImport(null);
    onExport();
    setDataStatus('Backup downloaded.');
  };

  if (!open) return null;

  return (
    <div className="drawer-backdrop" onClick={handleCloseWithRestore} role="presentation">
      <div
        id={id}
        ref={panelRef}
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-header">
          <div className="brand-identity">
            <span className="couch-mark">{brandIcon}</span>
            <h2 id={titleId} className="drawer-title">
              {SITE.name}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="secondary-btn icon-btn"
            aria-label="Close menu"
            onClick={handleCloseWithRestore}
          >
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">
          <div className="drawer-section">
            <a
              href={SITE.portalUrl}
              className="drawer-item drawer-portal-link"
              aria-label={`Back to ${SITE.portalName}`}
            >
              <ChevronLeft size={17} aria-hidden="true" />
              <span>{SITE.portalName}</span>
            </a>

            <button
              type="button"
              className="drawer-item"
              onClick={() => {
                onClose();
                onOpenHelp();
              }}
            >
              <CircleHelp size={17} aria-hidden="true" />
              <span>Help</span>
            </button>

            <button
              type="button"
              className="drawer-item"
              onClick={() => {
                onClose();
                onOpenAbout();
              }}
            >
              <Info size={17} aria-hidden="true" />
              <span>About</span>
            </button>

            <button
              type="button"
              className="drawer-item"
              onClick={() => {
                handleCloseWithRestore();
                onInstall();
              }}
            >
              <Download size={17} aria-hidden="true" />
              <span>Install {SITE.name}</span>
            </button>
          </div>

          <section className="drawer-data-section" aria-labelledby={dataHeadingId}>
            <h3 id={dataHeadingId} className="drawer-section-heading">
              Your Data
            </h3>
            <p className="drawer-data-note">
              Your lists are saved on this device only. Clearing browser data erases them.
            </p>

            <div className="drawer-data-actions">
              <button
                type="button"
                className="secondary-btn drawer-data-btn"
                onClick={handleExportClick}
              >
                <FileDown size={15} aria-hidden="true" />
                <span>Export</span>
              </button>
              <button
                ref={importButtonRef}
                type="button"
                className="secondary-btn drawer-data-btn"
                onClick={() => {
                  setDataError(null);
                  setDataStatus(null);
                  fileInputRef.current?.click();
                }}
              >
                <FileUp size={15} aria-hidden="true" />
                <span>Import</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                aria-label="Choose a Couch backup JSON file"
                onChange={handleFileChange}
              />
            </div>

            {pendingImport && (
              <div className="drawer-confirm-box" role="region" aria-label="Confirm import">
                <p className="drawer-confirm-text">
                  This will replace your current lists ({pendingImport.summary}).
                </p>
                <div className="drawer-confirm-actions">
                  <button
                    ref={confirmButtonRef}
                    type="button"
                    className="primary-btn drawer-confirm-btn"
                    onClick={handleConfirmImport}
                  >
                    Replace lists
                  </button>
                  <button
                    type="button"
                    className="secondary-btn drawer-confirm-btn"
                    onClick={handleCancelImport}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {dataError && (
              <p className="drawer-feedback drawer-feedback-error" role="alert">
                {dataError}
              </p>
            )}

            {dataStatus && !dataError && (
              <p className="drawer-feedback drawer-feedback-status" role="status">
                {dataStatus}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
