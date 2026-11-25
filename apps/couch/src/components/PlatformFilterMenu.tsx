import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface PlatformFilterOption {
  id: string;
  name: string;
  color: string;
  count: number;
}

interface PlatformFilterMenuProps {
  options: PlatformFilterOption[];
  selectedIds: string[];
  isAll: boolean;
  isNone: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClear: () => void;
}

/**
 * Compact “Platforms: All / N selected” menu with checkboxes.
 * Existing saved selections stay valid: an empty list still means All.
 */
export const PlatformFilterMenu: React.FC<PlatformFilterMenuProps> = ({
  options,
  selectedIds,
  isAll,
  isNone,
  onToggle,
  onSelectAll,
  onClear,
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLButtonElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const labelId = useId();

  const buttonLabel = isAll
    ? 'Platforms: All'
    : isNone
      ? 'Platforms: None'
      : `Platforms: ${selectedIds.length} selected`;

  useEffect(() => {
    if (!open) return;

    const onPointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (wrapRef.current && target && !wrapRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (next && wrapRef.current?.contains(next)) return;
      window.setTimeout(() => {
        const active = document.activeElement;
        if (wrapRef.current && active && active !== document.body && !wrapRef.current.contains(active)) {
          setOpen(false);
        }
      }, 0);
    };

    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    wrapRef.current?.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
      wrapRef.current?.removeEventListener('focusout', onFocusOut);
    };
  }, [open]);

  const fitMenu = (menu: HTMLDivElement | null) => {
    const button = buttonRef.current;
    if (!menu || !button) return;
    const rect = button.getBoundingClientRect();
    const nav = document.querySelector('.bottom-nav');
    const navTop = nav?.getBoundingClientRect().top ?? window.innerHeight;
    const gap = 6;
    const pad = 24;
    const spaceBelow = navTop - rect.bottom - gap - pad;
    const spaceAbove = rect.top - pad;
    const preferBelow = spaceBelow >= 220 || spaceBelow >= spaceAbove;
    if (preferBelow) {
      menu.style.top = `calc(100% + ${gap}px)`;
      menu.style.bottom = 'auto';
      menu.style.maxHeight = `${Math.max(120, spaceBelow)}px`;
    } else {
      menu.style.top = 'auto';
      menu.style.bottom = `calc(100% + ${gap}px)`;
      menu.style.maxHeight = `${Math.max(120, spaceAbove)}px`;
    }
  };

  useEffect(() => {
    if (!open) return;
    const layout = () => fitMenu(menuRef.current);
    const frame = window.requestAnimationFrame(layout);
    window.addEventListener('resize', layout);
    window.addEventListener('scroll', layout, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', layout);
      window.removeEventListener('scroll', layout, true);
    };
  }, [open]);

  return (
    <div className="platform-filter" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`platform-filter-button ${!isAll ? 'active' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{buttonLabel}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={(node) => {
            menuRef.current = node;
            fitMenu(node);
          }}
          id={menuId}
          className="platform-filter-menu"
          role="dialog"
          aria-labelledby={labelId}
        >
          <div className="platform-filter-menu-head">
            <span id={labelId} className="platform-filter-menu-title">
              Platforms
            </span>
            <div className="platform-filter-menu-actions">
              <button
                ref={selectAllRef}
                type="button"
                className="text-btn"
                onClick={() => {
                  onSelectAll();
                  window.requestAnimationFrame(() => clearRef.current?.focus());
                }}
                disabled={isAll}
              >
                Select all
              </button>
              <button
                ref={clearRef}
                type="button"
                className="text-btn"
                onClick={() => {
                  onClear();
                  window.requestAnimationFrame(() => selectAllRef.current?.focus());
                }}
                disabled={isNone}
              >
                Clear
              </button>
            </div>
          </div>
          <ul className="platform-filter-list">
            {options.map((option) => {
              const checked = isAll || selectedIds.includes(option.id);
              return (
                <li key={option.id}>
                  <label className="platform-filter-item">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => onToggle(option.id, event.target.checked)}
                    />
                    <span className="platform-dot" style={{ backgroundColor: option.color }} />
                    <span className="platform-filter-name">{option.name}</span>
                    <span className="muted small">{option.count}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
