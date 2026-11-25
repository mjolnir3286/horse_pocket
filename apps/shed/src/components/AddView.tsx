import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ImageUp, Lightbulb, Loader2, PencilLine, Search, Trash2, TriangleAlert, X } from 'lucide-react';
import {
  emptyNutrients,
  formatAmount,
  NUTRIENT_FIELDS,
  scaleNutrients,
  servingsFromAmount,
  type AmountMode,
  type NutrientKey,
  type Nutrients,
} from '../lib/nutrition';
import { parseNutritionLabel } from '../lib/parseLabel';
import { MEALS, type FoodItem, type Meal } from '../lib/storage';
import { formatDay } from '../lib/dates';
import { Segmented } from './Segmented';
import { CameraScanner, type CameraProblem } from './CameraScanner';
import { isPoorRead, type ScanIssue } from '../lib/frameAnalysis';

/** Short words for the "taken before the checks passed" note. */
const ISSUE_WORDS: Record<Exclude<ScanIssue, 'ok'>, string> = {
  dark: 'it was too dark',
  bright: 'it was too bright',
  glare: 'there was glare',
  moving: 'the camera was moving',
  'no-label': 'the label wasn’t in the frame',
  blurry: 'the picture was blurry',
};

/** Live camera needs the camera API (HTTPS only) and, when we can tell, a camera. */
const liveCameraApiAvailable = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;

interface Draft {
  name: string;
  servingSize: string;
  servingGrams: string;
  servingsPerContainer: string;
  per: Record<NutrientKey, string>;
}

const emptyDraft = (): Draft => ({
  name: '',
  servingSize: '',
  servingGrams: '',
  servingsPerContainer: '',
  per: Object.fromEntries(NUTRIENT_FIELDS.map((f) => [f.key, ''])) as Record<NutrientKey, string>,
});

const numStr = (n: number | null) => (n == null ? '' : String(n));
const toNum = (s: string): number | null => {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function draftFromFood(f: FoodItem): Draft {
  return {
    name: f.name,
    servingSize: f.servingSize,
    servingGrams: numStr(f.servingGrams),
    servingsPerContainer: numStr(f.servingsPerContainer),
    per: Object.fromEntries(NUTRIENT_FIELDS.map((x) => [x.key, numStr(f.per[x.key])])) as Record<NutrientKey, string>,
  };
}

function perFromDraft(d: Draft): Nutrients {
  const out = emptyNutrients();
  for (const f of NUTRIENT_FIELDS) out[f.key] = toNum(d.per[f.key]);
  return out;
}

type ScanState =
  | { kind: 'idle' }
  | { kind: 'working'; status: string; progress: number }
  | { kind: 'done'; found: number; uncertain: number; text: string }
  | { kind: 'error'; message: string };

export interface AddPayload {
  food: Omit<FoodItem, 'id' | 'createdAt' | 'lastUsedAt'> & { id: string | null };
  meal: Meal;
  servings: number;
  amountText: string;
  nutrients: Nutrients;
}

interface AddViewProps {
  date: string;
  meal: Meal;
  onMealChange: (m: Meal) => void;
  foods: FoodItem[];
  onAdd: (payload: AddPayload) => void;
  onDeleteFood: (food: FoodItem) => void;
}

export const AddView: React.FC<AddViewProps> = ({ date, meal, onMealChange, foods, onAdd, onDeleteFood }) => {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [foodId, setFoodId] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState<Set<NutrientKey>>(new Set());
  const [scan, setScan] = useState<ScanState>({ kind: 'idle' });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [amount, setAmount] = useState('1');
  const [mode, setMode] = useState<AmountMode>('servings');
  const [query, setQuery] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const takePhotoRef = useRef<HTMLButtonElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  /** Set when the live camera was refused or missing, so Take photo goes straight to the camera app this session. */
  const [liveCameraOff, setLiveCameraOff] = useState(() => !liveCameraApiAvailable());
  const [captureIssue, setCaptureIssue] = useState<ScanIssue | null>(null);
  const [tipDismissed, setTipDismissed] = useState(false);

  // No camera at all (most desktops): skip the live view and use the file picker.
  useEffect(() => {
    if (!liveCameraApiAvailable() || !navigator.mediaDevices.enumerateDevices) return;
    let active = true;
    const check = () =>
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          if (active && !devices.some((d) => d.kind === 'videoinput')) setLiveCameraOff(true);
        })
        .catch(() => undefined);
    check();
    navigator.mediaDevices.addEventListener?.('devicechange', check);
    return () => {
      active = false;
      navigator.mediaDevices.removeEventListener?.('devicechange', check);
    };
  }, []);

  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const servingGrams = toNum(draft.servingGrams);
  const servingsPerContainer = toNum(draft.servingsPerContainer);
  const per = useMemo(() => perFromDraft(draft), [draft]);
  const amountNum = toNum(amount) ?? 0;
  const servings = servingsFromAmount(amountNum, mode, servingGrams);
  const totals = servings != null ? scaleNutrients(per, servings) : null;

  useEffect(() => {
    if (mode === 'grams' && !servingGrams) setMode('servings');
  }, [mode, servingGrams]);

  const setField = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setNutrient = (key: NutrientKey, value: string) => {
    setDraft((d) => ({ ...d, per: { ...d.per, [key]: value } }));
    if (uncertain.has(key)) {
      const next = new Set(uncertain);
      next.delete(key);
      setUncertain(next);
    }
  };

  const resetForm = () => {
    setDraft(emptyDraft());
    setFoodId(null);
    setUncertain(new Set());
    setAmount('1');
    setMode('servings');
    setFormError(null);
    setScan({ kind: 'idle' });
    setCaptureIssue(null);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
  };

  const onPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void readPhoto(file, null);
  };

  const openCamera = () => {
    if (liveCameraOff) cameraRef.current?.click();
    else setCameraOpen(true);
  };

  const onCameraCapture = (photo: Blob, issue: ScanIssue | null) => {
    setCameraOpen(false);
    void readPhoto(photo, issue);
  };

  const onCameraUnavailable = (problem: CameraProblem) => {
    if (problem === 'denied' || problem === 'none') setLiveCameraOff(true);
  };

  const fallbackTo = (input: React.RefObject<HTMLInputElement | null>) => {
    setCameraOpen(false);
    input.current?.click();
  };

  const readPhoto = async (file: Blob, issue: ScanIssue | null) => {
    setCaptureIssue(issue);
    setTipDismissed(false);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
    setScan({ kind: 'working', status: 'Loading reader', progress: 0 });
    try {
      const { readLabelText } = await import('../lib/ocr');
      const text = await readLabelText(file, (p) =>
        setScan({ kind: 'working', status: p.status, progress: Math.max(0, Math.min(1, p.progress)) })
      );
      const parsed = parseNutritionLabel(text);
      setDraft((d) => ({
        ...d,
        servingSize: parsed.servingSize ?? d.servingSize,
        servingGrams: parsed.servingGrams != null ? String(parsed.servingGrams) : d.servingGrams,
        servingsPerContainer:
          parsed.servingsPerContainer != null ? String(parsed.servingsPerContainer) : d.servingsPerContainer,
        per: Object.fromEntries(
          NUTRIENT_FIELDS.map((f) => [f.key, parsed.nutrients[f.key] != null ? String(parsed.nutrients[f.key]) : d.per[f.key]])
        ) as Record<NutrientKey, string>,
      }));
      setFoodId(null);
      setUncertain(new Set(parsed.uncertain));
      setScan({ kind: 'done', found: parsed.found, uncertain: parsed.uncertain.length, text });
      window.requestAnimationFrame(() => nameRef.current?.focus());
    } catch (err) {
      console.error(err);
      setScan({
        kind: 'error',
        message: navigator.onLine
          ? 'Couldn’t read that photo. Try again with the label flat and well lit, or type the values in.'
          : 'The label reader needs to download once before it works offline. Connect and try again, or type the values in.',
      });
    }
  };

  const loadFood = (f: FoodItem) => {
    setDraft(draftFromFood(f));
    setFoodId(f.id);
    setUncertain(new Set());
    setAmount('1');
    setMode('servings');
    setScan({ kind: 'idle' });
    setFormError(null);
    formRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    window.requestAnimationFrame(() => nameRef.current?.focus({ preventScroll: true }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) {
      setFormError('Give the food a name so you can find it again.');
      nameRef.current?.focus();
      return;
    }
    if (per.calories == null) {
      setFormError('Enter calories per serving.');
      return;
    }
    if (servings == null || !totals) {
      setFormError(mode === 'grams' ? 'Enter grams eaten and the serving weight.' : 'Enter how many servings you ate.');
      return;
    }
    onAdd({
      food: {
        id: foodId,
        name,
        servingSize: draft.servingSize.trim(),
        servingGrams,
        servingsPerContainer,
        per,
      },
      meal,
      servings,
      amountText: formatAmount(amountNum, mode),
      nutrients: totals,
    });
    resetForm();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...foods].sort((a, b) => (a.lastUsedAt < b.lastUsedAt ? 1 : -1));
    return q ? list.filter((f) => f.name.toLowerCase().includes(q)) : list;
  }, [foods, query]);

  const quick: { label: string; value: number }[] = [
    { label: '½', value: 0.5 },
    { label: '1', value: 1 },
    { label: '1½', value: 1.5 },
    { label: '2', value: 2 },
  ];

  return (
    <div className="view">
      <h2 className="view-title">Add food</h2>

      <section className="card scan-card" aria-labelledby="scan-title">
        <div className="card-head">
          <h3 id="scan-title" className="card-title">
            Scan a Nutrition Facts label
          </h3>
        </div>
        <p className="muted small">Read on your device. Nothing is uploaded.</p>
        <div className="scan-actions">
          <button
            ref={takePhotoRef}
            type="button"
            className="primary-btn"
            onClick={openCamera}
            disabled={scan.kind === 'working'}
          >
            <Camera size={17} aria-hidden="true" />
            Take photo
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => pickerRef.current?.click()}
            disabled={scan.kind === 'working'}
          >
            <ImageUp size={16} aria-hidden="true" />
            Choose photo
          </button>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={onPhoto}
          />
          <input
            ref={pickerRef}
            type="file"
            accept="image/*"
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={onPhoto}
          />
        </div>

        {(photoUrl || scan.kind !== 'idle') && (
          <div className="scan-status-row">
            {photoUrl && <img className="scan-thumb" src={photoUrl} alt="Label photo" />}
            <div className="scan-status" role="status" aria-live="polite">
              {scan.kind === 'working' && (
                <>
                  <p className="scan-line">
                    <Loader2 size={16} className="spin" aria-hidden="true" /> {scan.status}…
                  </p>
                  <div className="progress small" aria-hidden="true">
                    <div className="progress-fill" style={{ width: `${Math.round(scan.progress * 100)}%` }} />
                  </div>
                </>
              )}
              {scan.kind === 'done' && (
                <>
                  {captureIssue && captureIssue !== 'ok' && (
                    <p className="scan-line scan-note">
                      <TriangleAlert size={15} aria-hidden="true" /> Taken while {ISSUE_WORDS[captureIssue]}, so it may not read well.
                    </p>
                  )}
                  <p className="scan-line">
                    {scan.found >= 4 ? 'Read the label.' : scan.found > 0 ? 'Read part of the label.' : 'Couldn’t find label values.'}{' '}
                    {scan.uncertain > 0 ? 'Check the highlighted fields.' : scan.found > 0 ? 'Check the numbers before adding.' : 'Try another photo or type them in.'}
                  </p>
                  <details className="raw-text">
                    <summary>Text the reader saw</summary>
                    <pre>{scan.text.trim() || '(nothing)'}</pre>
                  </details>
                </>
              )}
              {scan.kind === 'error' && (
                <p className="scan-line text-danger">
                  <TriangleAlert size={16} aria-hidden="true" /> {scan.message}
                </p>
              )}
            </div>
          </div>
        )}

        {scan.kind === 'done' && !tipDismissed && isPoorRead(scan.found, scan.uncertain) && (
          <div className="retry-tip" role="note" aria-labelledby="retry-tip-title">
            <p id="retry-tip-title" className="retry-tip-title">
              <Lightbulb size={16} aria-hidden="true" /> Didn’t read well? Try again
            </p>
            <ul>
              <li>Lay the package flat and fill the frame with the top of the label.</li>
              <li>Use bright, even light. Tilt the package if you see a shiny spot.</li>
              <li>Hold steady until the frame turns green.</li>
            </ul>
            <div className="retry-tip-actions">
              <button type="button" className="primary-btn" onClick={openCamera}>
                <Camera size={16} aria-hidden="true" /> Try again
              </button>
              <button type="button" className="ghost-btn" onClick={() => setTipDismissed(true)}>
                Dismiss
              </button>
            </div>
          </div>
        )}
      </section>

      {cameraOpen && (
        <CameraScanner
          onClose={() => setCameraOpen(false)}
          onCapture={onCameraCapture}
          onUnavailable={onCameraUnavailable}
          onUseCameraApp={() => fallbackTo(cameraRef)}
          onChoosePhoto={() => fallbackTo(pickerRef)}
          restoreFocusRef={takePhotoRef}
        />
      )}

      <section ref={formRef} className="card form-card" aria-labelledby="food-title">
        <form onSubmit={submit} noValidate>
          <div className="card-head">
            <h3 id="food-title" className="card-title">
              <PencilLine size={16} aria-hidden="true" /> {foodId ? 'Saved food' : 'Label values'}
            </h3>
            {(draft.name || foodId || scan.kind === 'done') && (
              <button type="button" className="ghost-btn" onClick={resetForm}>
                <X size={15} aria-hidden="true" /> Clear
              </button>
            )}
          </div>

          <label className="field">
            <span className="field-label">Food name</span>
            <input
              ref={nameRef}
              className="input"
              value={draft.name}
              placeholder="e.g. Granola bar"
              autoComplete="off"
              onChange={(e) => setField({ name: e.target.value })}
            />
          </label>

          <div className="field-row">
            <label className="field grow">
              <span className="field-label">Serving size</span>
              <input
                className="input"
                value={draft.servingSize}
                placeholder="e.g. 2/3 cup"
                onChange={(e) => setField({ servingSize: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Serving weight (g)</span>
              <input
                className="input"
                inputMode="decimal"
                value={draft.servingGrams}
                placeholder="g"
                onChange={(e) => setField({ servingGrams: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Servings per container</span>
              <input
                className="input"
                inputMode="decimal"
                value={draft.servingsPerContainer}
                onChange={(e) => setField({ servingsPerContainer: e.target.value })}
              />
            </label>
          </div>

          <fieldset className="nutrient-fieldset">
            <legend className="field-label">Per serving</legend>
            <div className="nutrient-grid">
              {NUTRIENT_FIELDS.map((f) => {
                const unsure = uncertain.has(f.key);
                return (
                  <label key={f.key} className={`field nutrient-field ${unsure ? 'is-unsure' : ''} ${f.key === 'calories' ? 'is-calories' : ''}`}>
                    <span className="field-label">
                      {f.label} <span className="unit">{f.unit}</span>
                      {unsure && <span className="visually-hidden"> (check this value)</span>}
                    </span>
                    <input
                      className="input"
                      inputMode="decimal"
                      value={draft.per[f.key]}
                      aria-invalid={unsure || undefined}
                      onChange={(e) => setNutrient(f.key, e.target.value)}
                    />
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="amount-block">
            <span className="field-label" id="amount-label">
              How much did you eat?
            </span>
            <div className="amount-row">
              <input
                className="input amount-input"
                inputMode="decimal"
                aria-labelledby="amount-label"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Segmented<AmountMode>
                label="Amount unit"
                hideLabel
                value={mode}
                onChange={(m) => {
                  if (m === 'grams' && !servingGrams) return;
                  if (m === 'grams' && mode === 'servings' && servingGrams) {
                    setAmount(String(Math.round((toNum(amount) ?? 1) * servingGrams)));
                  } else if (m === 'servings' && mode === 'grams' && servingGrams) {
                    setAmount(String(Math.round(((toNum(amount) ?? servingGrams) / servingGrams) * 100) / 100));
                  }
                  setMode(m);
                }}
                options={[
                  { value: 'servings', label: 'Servings' },
                  { value: 'grams', label: 'Grams' },
                ]}
              />
            </div>
            {mode === 'servings' && (
              <div className="chip-row" role="group" aria-label="Quick amounts">
                {quick.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    className={`chip ${amountNum === q.value ? 'is-active' : ''}`}
                    onClick={() => setAmount(String(q.value))}
                  >
                    {q.label}
                  </button>
                ))}
                {servingsPerContainer != null && servingsPerContainer > 0 && (
                  <button
                    type="button"
                    className={`chip ${amountNum === servingsPerContainer ? 'is-active' : ''}`}
                    onClick={() => setAmount(String(servingsPerContainer))}
                  >
                    Whole package ({servingsPerContainer})
                  </button>
                )}
              </div>
            )}
            {!servingGrams && <p className="muted small">Add the serving weight to enter grams.</p>}
          </div>

          <div className="amount-result" aria-live="polite">
            {totals && per.calories != null ? (
              <>
                <span className="amount-kcal">
                  {totals.calories?.toLocaleString()} <small>kcal</small>
                </span>
                <span className="amount-macros">
                  P {totals.protein ?? '–'} g · C {totals.carbs ?? '–'} g · F {totals.fat ?? '–'} g
                </span>
              </>
            ) : (
              <span className="muted small">Enter calories and an amount to see totals.</span>
            )}
          </div>

          <Segmented<Meal>
            label={`Meal · ${formatDay(date)}`}
            value={meal}
            onChange={onMealChange}
            options={MEALS.map((m) => ({ value: m.key, label: m.label }))}
          />

          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}

          <button type="submit" className="primary-btn wide">
            Add to {MEALS.find((m) => m.key === meal)?.label}
          </button>
        </form>
      </section>

      <section className="card saved-card" aria-labelledby="saved-title">
        <div className="card-head">
          <h3 id="saved-title" className="card-title">
            Saved foods
          </h3>
          <span className="muted small">{foods.length}</span>
        </div>
        {foods.length === 0 ? (
          <p className="muted small">Foods you add are saved here so you can add them again in one tap.</p>
        ) : (
          <>
            <label className="search-field">
              <Search size={16} aria-hidden="true" />
              <input
                className="input"
                type="search"
                placeholder="Search saved foods"
                aria-label="Search saved foods"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <ul className="saved-list">
              {filtered.map((f) => (
                <li key={f.id} className="saved-row">
                  <button type="button" className="saved-main" onClick={() => loadFood(f)}>
                    <span className="entry-name">{f.name}</span>
                    <span className="entry-meta">
                      {f.per.calories ?? '–'} kcal{f.servingSize ? ` per ${f.servingSize}` : ' per serving'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="ghost-btn icon-btn"
                    aria-label={`Delete saved food ${f.name}`}
                    title="Delete"
                    onClick={() => onDeleteFood(f)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
              {filtered.length === 0 && <li className="muted small">No matches.</li>}
            </ul>
          </>
        )}
      </section>
    </div>
  );
};
