import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  Download,
  FileDown,
  Frame,
  Hand,
  ImageUp,
  SunMedium,
  Lightbulb,
  RotateCcw,
  FileUp,
  History,
  Keyboard,
  NotebookPen,
  PlusCircle,
  Scale,
  Target,
  UserRound,
  X,
} from 'lucide-react';
import { SITE } from '../config/site';
import { useFocusTrap } from '../lib/useFocusTrap';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
  restoreFocusRef?: React.RefObject<HTMLElement | null>;
}

type Item = { icon: React.ReactNode; label: string; text: React.ReactNode };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Tabs',
    items: [
      { icon: <NotebookPen size={16} />, label: 'Today', text: 'Your log for the day by meal, with calories eaten against your target and a protein, carbs, and fat summary. Use the arrows to look at other days.' },
      { icon: <PlusCircle size={16} />, label: 'Add', text: 'Scan a label or type it in, say how much you ate, and add it to a meal. Saved foods are listed below the form.' },
      { icon: <History size={16} />, label: 'History', text: 'Past days with their totals. Tap a day to open it.' },
      { icon: <UserRound size={16} />, label: 'Profile', text: 'Height, weight, age, sex, and activity set your daily calorie target.' },
    ],
  },
  {
    title: 'Scanning a label',
    items: [
      { icon: <Camera size={16} />, label: 'Take photo', text: 'Opens the camera with a frame to line the label up in. Shed checks the picture while you aim and only reads what’s inside the frame.' },
      { icon: <ImageUp size={16} />, label: 'Choose photo', text: 'Pick a photo you already took. If the camera is blocked or your device has none, Take photo opens your camera app or file picker instead.' },
      { icon: <Keyboard size={16} />, label: 'Check the numbers', text: 'Reading happens on your device and can misread digits, especially a “g” as a “9”. Fields Shed is unsure about are highlighted. Everything stays editable, and you can type a label in by hand.' },
      { icon: <Download size={16} />, label: 'First scan', text: 'The first scan downloads the label reader (about 7 MB) from this site. After that it’s cached and works offline.' },
    ],
  },
  {
    title: 'Getting a good scan',
    items: [
      { icon: <Frame size={16} />, label: 'Fill the frame', text: 'Lay the package flat and line up the top of the Nutrition Facts label with the frame, from the title down past Calories. Curved packages read better if you flatten the label with a finger.' },
      { icon: <SunMedium size={16} />, label: 'Light', text: 'Use bright, even light. If Shed says it’s too dark, move closer to a light or turn on the flashlight button when your phone has one.' },
      { icon: <Lightbulb size={16} />, label: 'Glare', text: 'Shiny wrappers reflect light and hide numbers. Tilt the package a little until the bright spot moves off the label.' },
      { icon: <Hand size={16} />, label: 'Hold steady', text: 'Hold still until the frame turns green and the hint says “Looks good”. If it says blurry, move back a little so the camera can focus. You can still take the photo anytime, but it may not read well.' },
      { icon: <Camera size={16} />, label: 'Camera access', text: 'The camera only runs while the scan screen is open, and pictures stay on your device. If you said no to camera access, turn it back on in your browser’s site settings.' },
    ],
  },
  {
    title: 'Amounts and targets',
    items: [
      { icon: <Scale size={16} />, label: 'Servings or grams', text: 'Enter how many servings you ate, or the weight in grams if the label lists a serving weight like “(55g)”. Shed scales every nutrient to match.' },
      { icon: <Target size={16} />, label: 'Daily target', text: 'Shed estimates your resting burn (BMR) with the Mifflin-St Jeor equation, multiplies by your activity level for maintenance (TDEE), then applies your goal. Loss targets are capped at 25% below maintenance and never go under 1,200 (women) or 1,500 (men) calories.' },
    ],
  },
  {
    title: 'Install and your data',
    items: [
      { icon: <Download size={16} />, label: 'Install', text: 'Use Install in the menu or your browser’s “Add to Home Screen” option to open Shed like an app.' },
      {
        icon: (
          <span className="help-backup-icons">
            <FileDown size={14} />
            <FileUp size={14} />
          </span>
        ),
        label: 'Backups',
        text: 'Everything is saved on this device only. Use Export JSON in the menu to keep a backup, and Import JSON to restore it here or on another device.',
      },
      {
        icon: <RotateCcw size={16} />,
        label: 'Reset',
        text: 'Reset app data in the menu erases Shed’s profile, foods, and log on this device and starts fresh. Export first to keep a copy.',
      },
    ],
  },
];

export const HelpModal: React.FC<HelpModalProps> = ({ open, onClose, restoreFocusRef }) => {
  const titleId = useId();
  const descId = useId();
  const baseId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useFocusTrap(open, dialogRef, onClose, closeRef, restoreFocusRef);
  useEffect(() => {
    if (open) setOpenIndex(null);
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="modal-sheet help-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-header">
          <div>
            <p className="sheet-kicker">Help</p>
            <h2 id={titleId} className="sheet-title">
              {SITE.name}
            </h2>
          </div>
          <button ref={closeRef} type="button" className="secondary-btn icon-btn" aria-label="Close help" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <p id={descId} className="sheet-intro">
          Shed reads nutrition labels and keeps a simple calorie log. Everything is saved on this device only.
        </p>
        <div className="help-accordion">
          {SECTIONS.map((section, i) => {
            const expanded = openIndex === i;
            const bodyId = `${baseId}-s${i}`;
            return (
              <section className="help-section" key={section.title}>
                <button
                  type="button"
                  className="help-section-toggle"
                  aria-expanded={expanded}
                  aria-controls={bodyId}
                  onClick={() => setOpenIndex(expanded ? null : i)}
                >
                  <span>{section.title}</span>
                  <ChevronDown size={18} className={`help-chevron${expanded ? ' is-open' : ''}`} aria-hidden="true" />
                </button>
                <div id={bodyId} role="region" hidden={!expanded} className="help-section-body">
                  <ul className="help-list">
                    {section.items.map((item) => (
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
            );
          })}
        </div>
        <div className="sheet-actions">
          <button type="button" className="primary-btn" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
