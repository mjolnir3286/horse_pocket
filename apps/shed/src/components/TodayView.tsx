import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, CopyPlus, Plus, Target, Trash2 } from 'lucide-react';
import type { EnergyResult } from '../lib/energy';
import { sumNutrients, type Nutrients } from '../lib/nutrition';
import { MEALS, type LogEntry, type Meal } from '../lib/storage';
import { dayKey, formatDay, shiftDay } from '../lib/dates';

interface TodayViewProps {
  date: string;
  onDateChange: (date: string) => void;
  entries: LogEntry[];
  energy: EnergyResult | null;
  onAddToMeal: (meal: Meal) => void;
  onDelete: (entry: LogEntry) => void;
  onCopyToToday: (entry: LogEntry) => void;
  onOpenProfile: () => void;
}

const fmt = (n: number | null, digits = 0) =>
  n == null ? '–' : n.toLocaleString(undefined, { maximumFractionDigits: digits });

export function MacroSummary({ totals }: { totals: Nutrients }) {
  const p = totals.protein ?? 0;
  const c = totals.carbs ?? 0;
  const f = totals.fat ?? 0;
  const kcal = p * 4 + c * 4 + f * 9;
  const pct = (v: number) => (kcal > 0 ? Math.round((v / kcal) * 100) : 0);
  const items = [
    { key: 'protein', label: 'Protein', grams: p, share: pct(p * 4) },
    { key: 'carbs', label: 'Carbs', grams: c, share: pct(c * 4) },
    { key: 'fat', label: 'Fat', grams: f, share: pct(f * 9) },
  ];
  return (
    <div className="macro-grid">
      {items.map((m) => (
        <div key={m.key} className={`macro-cell macro-${m.key}`}>
          <span className="macro-label">{m.label}</span>
          <span className="macro-value">{fmt(m.grams, 1)} g</span>
          <span className="macro-share" aria-label={`${m.share} percent of calories from ${m.label.toLowerCase()}`}>
            {m.share}%
          </span>
        </div>
      ))}
    </div>
  );
}

export const TodayView: React.FC<TodayViewProps> = ({
  date,
  onDateChange,
  entries,
  energy,
  onAddToMeal,
  onDelete,
  onCopyToToday,
  onOpenProfile,
}) => {
  const today = dayKey();
  const isToday = date === today;
  const totals = useMemo(() => sumNutrients(entries.map((e) => e.nutrients)), [entries]);
  const eaten = totals.calories ?? 0;
  const target = energy?.target ?? null;
  const remaining = target != null ? target - eaten : null;
  const progress = target ? Math.min(1, eaten / target) : 0;
  const over = remaining != null && remaining < 0;

  return (
    <div className="view">
      <div className="day-nav">
        <button type="button" className="secondary-btn icon-btn" aria-label="Previous day" onClick={() => onDateChange(shiftDay(date, -1))}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <h2 className="day-title" aria-live="polite">
          {formatDay(date, today)}
        </h2>
        <button
          type="button"
          className="secondary-btn icon-btn"
          aria-label="Next day"
          disabled={isToday}
          onClick={() => onDateChange(shiftDay(date, 1))}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        {!isToday && (
          <button type="button" className="secondary-btn day-today-btn" onClick={() => onDateChange(today)}>
            Today
          </button>
        )}
      </div>

      <section className="card summary-card" aria-label="Calories">
        <div className="summary-top">
          <div>
            <p className="summary-kicker">Eaten</p>
            <p className="summary-big">
              {fmt(eaten)} <span className="summary-unit">kcal</span>
            </p>
          </div>
          {target != null ? (
            <div className="summary-right">
              <p className="summary-kicker">{over ? 'Over' : 'Left'}</p>
              <p className={`summary-big ${over ? 'is-over' : ''}`}>{fmt(Math.abs(remaining!))}</p>
              <p className="summary-target">of {fmt(target)} target</p>
            </div>
          ) : (
            <button type="button" className="secondary-btn" onClick={onOpenProfile}>
              <Target size={15} aria-hidden="true" />
              Set a target
            </button>
          )}
        </div>
        {target != null && (
          <div
            className={`progress ${over ? 'is-over' : ''}`}
            role="progressbar"
            aria-label="Calories eaten against target"
            aria-valuemin={0}
            aria-valuemax={target}
            aria-valuenow={Math.round(eaten)}
          >
            <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
        <MacroSummary totals={totals} />
        <p className="summary-extra">
          Fiber {fmt(totals.fiber, 1)} g · Sugars {fmt(totals.sugar, 1)} g · Sodium {fmt(totals.sodium)} mg
        </p>
      </section>

      {MEALS.map((meal) => {
        const list = entries.filter((e) => e.meal === meal.key);
        const kcal = list.reduce((s, e) => s + (e.nutrients.calories ?? 0), 0);
        return (
          <section key={meal.key} className="card meal-card" aria-labelledby={`meal-${meal.key}`}>
            <div className="meal-head">
              <h3 id={`meal-${meal.key}`} className="meal-title">
                {meal.label}
              </h3>
              <span className="meal-kcal">{list.length > 0 ? `${fmt(kcal)} kcal` : ''}</span>
              <button
                type="button"
                className="secondary-btn icon-btn"
                aria-label={`Add food to ${meal.label}`}
                onClick={() => onAddToMeal(meal.key)}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
            {list.length === 0 ? (
              <p className="meal-empty">Nothing logged.</p>
            ) : (
              <ul className="entry-list">
                {list.map((e) => (
                  <li key={e.id} className="entry-row">
                    <div className="entry-main">
                      <span className="entry-name">{e.name}</span>
                      <span className="entry-meta">
                        {e.amountText}
                        {e.nutrients.protein != null && ` · P ${fmt(e.nutrients.protein, 1)}`}
                        {e.nutrients.carbs != null && ` · C ${fmt(e.nutrients.carbs, 1)}`}
                        {e.nutrients.fat != null && ` · F ${fmt(e.nutrients.fat, 1)}`}
                      </span>
                    </div>
                    <span className="entry-kcal">{fmt(e.nutrients.calories)}</span>
                    {!isToday && (
                      <button
                        type="button"
                        className="ghost-btn icon-btn"
                        aria-label={`Add ${e.name} to today`}
                        title="Add to today"
                        onClick={() => onCopyToToday(e)}
                      >
                        <CopyPlus size={16} aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="ghost-btn icon-btn"
                      aria-label={`Remove ${e.name}`}
                      title="Remove"
                      onClick={() => onDelete(e)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
};
