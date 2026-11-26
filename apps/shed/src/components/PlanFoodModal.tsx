import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import {
  formatAmount,
  scaleNutrients,
  servingsFromAmount,
  type AmountMode,
} from '../lib/nutrition';
import { MEALS, type FoodItem, type Meal, type PlanEntry } from '../lib/storage';
import { formatDay } from '../lib/dates';
import { useFocusTrap } from '../lib/useFocusTrap';
import { Segmented } from './Segmented';

interface PlanFoodModalProps {
  open: boolean;
  date: string;
  initialMeal: Meal;
  foods: FoodItem[];
  onClose: () => void;
  onSave: (item: Omit<PlanEntry, 'id' | 'createdAt'>) => void;
  onGoToAdd: () => void;
  restoreFocusRef?: React.RefObject<HTMLElement | null>;
}

const toPositiveNum = (s: string): number | null => {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const PlanFoodModal: React.FC<PlanFoodModalProps> = ({
  open,
  date,
  initialMeal,
  foods,
  onClose,
  onSave,
  onGoToAdd,
  restoreFocusRef,
}) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState('1');
  const [mode, setMode] = useState<AmountMode>('servings');
  const [error, setError] = useState<string | null>(null);

  useFocusTrap(open, dialogRef, onClose, closeRef, restoreFocusRef);

  useEffect(() => {
    if (open) {
      setMeal(initialMeal);
      setQuery('');
      setSelectedId(foods[0]?.id ?? null);
      setAmount('1');
      setMode('servings');
      setError(null);
    }
  }, [open, initialMeal, foods]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...foods].sort((a, b) => (a.lastUsedAt < b.lastUsedAt ? 1 : -1));
    return q ? sorted.filter((f) => f.name.toLowerCase().includes(q)) : sorted;
  }, [foods, query]);

  const selectedFood = useMemo(
    () => foods.find((f) => f.id === selectedId) ?? filtered[0] ?? null,
    [foods, selectedId, filtered]
  );

  useEffect(() => {
    if (mode === 'grams' && !selectedFood?.servingGrams) {
      setMode('servings');
    }
  }, [mode, selectedFood]);

  if (!open) return null;

  const amountNum = toPositiveNum(amount) ?? 0;
  const servings = selectedFood ? servingsFromAmount(amountNum, mode, selectedFood.servingGrams) : null;
  const totals = selectedFood && servings != null ? scaleNutrients(selectedFood.per, servings) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFood) {
      setError('Choose a saved food first.');
      return;
    }
    if (!servings || !totals) {
      setError('Enter an amount greater than zero.');
      return;
    }
    onSave({
      date,
      meal,
      foodId: selectedFood.id,
      name: selectedFood.name,
      servings,
      amountText: formatAmount(amountNum, mode),
      nutrients: totals,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="modal-sheet plan-modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-header">
          <div>
            <p className="sheet-kicker">Plan meal · {formatDay(date)}</p>
            <h2 id={titleId} className="sheet-title">
              Add saved food
            </h2>
          </div>
          <button ref={closeRef} type="button" className="secondary-btn icon-btn" aria-label="Close" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {foods.length === 0 ? (
          <div className="plan-modal-empty">
            <p className="muted">
              No saved foods yet. Scan a nutrition label or enter a food in the Add tab first, then arrange it here.
            </p>
            <div className="sheet-actions">
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  onClose();
                  onGoToAdd();
                }}
              >
                <Plus size={16} aria-hidden="true" />
                Go to Add
              </button>
            </div>
          </div>
        ) : (
          <form className="plan-modal-form" onSubmit={submit}>
            <Segmented<Meal>
              label="Meal slot"
              value={meal}
              onChange={setMeal}
              options={MEALS.map((m) => ({ value: m.key, label: m.label }))}
            />

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

            <ul className="plan-food-list" role="listbox" aria-label="Saved foods">
              {filtered.map((f) => {
                const active = selectedFood?.id === f.id;
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`plan-food-option ${active ? 'is-active' : ''}`}
                      onClick={() => {
                        setSelectedId(f.id);
                        setError(null);
                      }}
                    >
                      <span className="entry-name">{f.name}</span>
                      <span className="entry-meta">
                        {f.per.calories ?? '–'} kcal{f.servingSize ? ` per ${f.servingSize}` : ' per serving'}
                      </span>
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && <li className="muted small plan-food-none">No saved foods match.</li>}
            </ul>

            {selectedFood && (
              <div className="amount-block">
                <div className="amount-row plan-modal-amount-row">
                  <label className="field plan-modal-amount-field">
                    <span className="field-label">Amount</span>
                    <input
                      className="input"
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        setError(null);
                      }}
                    />
                  </label>
                  {selectedFood.servingGrams ? (
                    <Segmented<AmountMode>
                      label="Unit"
                      value={mode}
                      onChange={(next) => {
                        setMode(next);
                        setAmount(next === 'grams' ? String(selectedFood.servingGrams) : '1');
                      }}
                      options={[
                        { value: 'servings', label: 'Servings' },
                        { value: 'grams', label: 'Grams' },
                      ]}
                    />
                  ) : (
                    <span className="muted small">
                      {selectedFood.servingSize ? `1 serving = ${selectedFood.servingSize}` : 'Measured in servings'}
                    </span>
                  )}
                </div>

                {mode === 'servings' && (
                  <div className="chip-row">
                    {['0.5', '1', '1.5', '2'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`chip ${amount === preset ? 'is-active' : ''}`}
                        onClick={() => {
                          setAmount(preset);
                          setError(null);
                        }}
                      >
                        {preset}×
                      </button>
                    ))}
                  </div>
                )}

                <div className="amount-result" aria-live="polite">
                  {totals ? (
                    <>
                      <span className="amount-kcal">
                        {totals.calories != null ? totals.calories.toLocaleString() : '–'} <small>kcal</small>
                      </span>
                      <span className="amount-macros">
                        P {totals.protein ?? '–'} g · C {totals.carbs ?? '–'} g · F {totals.fat ?? '–'} g
                      </span>
                    </>
                  ) : (
                    <span className="muted small">Enter an amount to see totals.</span>
                  )}
                </div>
              </div>
            )}

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <div className="sheet-actions plan-modal-actions">
              <button type="button" className="secondary-btn" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="primary-btn" disabled={!selectedFood}>
                Add to {MEALS.find((m) => m.key === meal)?.label}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
