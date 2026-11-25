import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, CircleHelp, Download, FileDown, FileUp, Info, X } from 'lucide-react';
import { SITE } from '../config/site';
import { useFocusTrap } from '../lib/useFocusTrap';
import { ShedMark } from './ShedMark';

export interface PendingImport {
  summary: string;
  apply: () => void;
}

interface SideMenuProps {
  id: string;
  open: boolean;
  onClose: () => void;
  restoreFocusRef: React.RefObject<HTMLElement | null>;
  onOpenHelp: () => void;
  onOpenAbout: () => void;
  onInstall: () => void;
  installed: boolean;
  onExport: () => void;
  onValidateImport: (raw: string) => { ok: true; pending: PendingImport } | { ok: false; error: string };
}

export const SideMenu: React.FC<SideMenuProps> = ({
  id,
  open,
  onClose,
  restoreFocusRef,
  onOpenHelp,
  onOpenAbout,
  onInstall,
  installed,
  onExport,
  onValidateImport,
}) => {
  const titleId = useId();
  const dataHeadingId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const importRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useFocusTrap(open, panelRef, onClose, closeRef, restoreFocusRef);

  useEffect(() => {
    if (!open) {
      setPending(null);
      setError(null);
      setStatus(null);
    }
  }, [open]);

  useEffect(() => {
    if (pending) window.requestAnimationFrame(() => confirmRef.current?.focus());
  }, [pending]);

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    setStatus(null);
    try {
      const res = onValidateImport(await file.text());
      if (res.ok) setPending(res.pending);
      else {
        setPending(null);
        setError(res.error);
      }
    } catch {
      setPending(null);
      setError('Could not read that file. Choose a Shed backup (.json).');
    }
  };

  if (!open) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <div
        id={id}
        ref={panelRef}
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-header">
          <div className="brand-identity">
            <span className="shed-mark">
              <ShedMark />
            </span>
            <h2 id={titleId} className="drawer-title">
              {SITE.name}
            </h2>
          </div>
          <button ref={closeRef} type="button" className="secondary-btn icon-btn" aria-label="Close menu" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="drawer-body">
          <div className="drawer-section">
            <a href={SITE.portalUrl} className="drawer-item drawer-portal-link" aria-label={`Back to ${SITE.portalName}`}>
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
            {!installed && (
              <button
                type="button"
                className="drawer-item"
                onClick={() => {
                  onClose();
                  onInstall();
                }}
              >
                <Download size={17} aria-hidden="true" />
                <span>Install {SITE.name}</span>
              </button>
            )}
          </div>

          <section className="drawer-data-section" aria-labelledby={dataHeadingId}>
            <h3 id={dataHeadingId} className="drawer-section-heading">
              Your Data
            </h3>
            <p className="drawer-data-note">
              Your log, saved foods, and profile are saved on this device only. Clearing browser data erases them, so
              export a backup now and then.
            </p>
            <div className="drawer-data-actions">
              <button
                type="button"
                className="secondary-btn drawer-data-btn"
                onClick={() => {
                  setError(null);
                  setPending(null);
                  onExport();
                  setStatus('Backup downloaded.');
                }}
              >
                <FileDown size={15} aria-hidden="true" />
                Export JSON
              </button>
              <button
                ref={importRef}
                type="button"
                className="secondary-btn drawer-data-btn"
                onClick={() => fileRef.current?.click()}
              >
                <FileUp size={15} aria-hidden="true" />
                Import JSON
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="visually-hidden"
                tabIndex={-1}
                aria-hidden="true"
                onChange={onFile}
              />
            </div>
            {pending && (
              <div className="drawer-confirm-box" role="alertdialog" aria-label="Confirm import">
                <p className="drawer-data-note">{pending.summary}</p>
                <div className="drawer-data-actions">
                  <button
                    type="button"
                    className="secondary-btn drawer-data-btn"
                    onClick={() => {
                      setPending(null);
                      window.requestAnimationFrame(() => importRef.current?.focus());
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    ref={confirmRef}
                    type="button"
                    className="primary-btn drawer-data-btn"
                    onClick={() => {
                      pending.apply();
                      setPending(null);
                      setStatus('Backup imported.');
                      window.requestAnimationFrame(() => importRef.current?.focus());
                    }}
                  >
                    Replace data
                  </button>
                </div>
              </div>
            )}
            <p className="drawer-data-status" role="status" aria-live="polite">
              {error ? <span className="text-danger">{error}</span> : status}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
