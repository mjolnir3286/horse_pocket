import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, ExternalLink, Plus, Target, Trash2 } from 'lucide-react';
import type { EnergyResult } from '../lib/energy';
import { sumNutrients } from '../lib/nutrition';
import { MEALS, type FoodItem, type LogEntry, type Meal, type PlanEntry } from '../lib/storage';
import {
  dayOfMonth,
  formatDay,
  formatLongDay,
  formatWeekRange,
  planBounds,
  shiftDay,
  shortWeekday,
  weekDays,
} from '../lib/dates';
import { countOlderLogEntries, summarizeLogByDate, summarizePlanByDate } from '../lib/plan';
import { MacroSummary } from './TodayView';
import { PlanFoodModal } from './PlanFoodModal';

interface PlanViewProps {
  today: string;
  log: LogEntry[];
  plan: PlanEntry[];
  foods: FoodItem[];
  energy: EnergyResult | null;
  onOpenDay: (date: string) => void;
  onOpenAdd: () => void;
  onOpenProfile: () => void;
  onAddPlanItem: (item: Omit<PlanEntry, 'id' | 'createdAt'>) => void;
  onDeletePlanItem: (item: PlanEntry) => void;
  onEatPlanItems: (items: PlanEntry[], targetDate: string) => void;
}

const fmt = (n: number | null, digits = 0) =>
  n == null ? '–' : n.toLocaleString(undefined, { maximumFractionDigits: digits });

const fmtCellKcal = (kcal: number) => {
  const rounded = Math.round(kcal);
  if (rounded >= 10000) return `${Math.round(rounded / 1000)}k`;
  return String(rounded);
};

export const PlanView: React.FC<PlanViewProps> = ({
  today,
  log,
  plan,
  foods,
  energy,
  onOpenDay,
  onOpenAdd,
  onOpenProfile,
  onAddPlanItem,
  onDeletePlanItem,
  onEatPlanItems,
}) => {
  const bounds = useMemo(() => planBounds(today), [today]);
  const [weekStart, setWeekStart] = useState<string>(() => bounds.currentWeekStart);
  const [selectedDate, setSelectedDate] = useState<string>(() => today);
  const [pickerMeal, setPickerMeal] = useState<Meal | null>(null);
  const pickerTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (weekStart < bounds.minWeekStart) setWeekStart(bounds.minWeekStart);
    else if (weekStart > bounds.maxWeekStart) setWeekStart(bounds.maxWeekStart);
    if (selectedDate < bounds.minDay) setSelectedDate(bounds.minDay);
    else if (selectedDate > bounds.maxDay) setSelectedDate(bounds.maxDay);
  }, [bounds, weekStart, selectedDate]);

  const daysInWeek = useMemo(() => weekDays(weekStart), [weekStart]);
  const logByDate = useMemo(() => summarizeLogByDate(log), [log]);
  const planByDate = useMemo(() => summarizePlanByDate(plan), [plan]);
  const olderCount = useMemo(() => countOlderLogEntries(log, bounds.minDay), [log, bounds.minDay]);

  const dayLogEntries = useMemo(
    () => log.filter((e) => e.date === selectedDate).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [log, selectedDate]
  );
  const dayPlanEntries = useMemo(
    () => plan.filter((e) => e.date === selectedDate).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [plan, selectedDate]
  );

  const isPast = selectedDate < today;
  const isToday = selectedDate === today;
  const isFuture = selectedDate > today;
  const target = energy?.target ?? null;

  const logTotals = useMemo(() => sumNutrients(dayLogEntries.map((e) => e.nutrients)), [dayLogEntries]);
  const planTotals = useMemo(() => sumNutrients(dayPlanEntries.map((e) => e.nutrients)), [dayPlanEntries]);

  const activeTotals = isFuture ? planTotals : logTotals;
  const activeKcal = activeTotals.calories ?? 0;
  const remaining = target != null ? target - activeKcal : null;
  const progress = target ? Math.min(1, activeKcal / target) : 0;
  const over = remaining != null && remaining < 0;

  const shiftWeek = (deltaWeeks: number) => {
    const nextWeek = shiftDay(weekStart, deltaWeeks * 7);
    if (nextWeek < bounds.minWeekStart || nextWeek > bounds.maxWeekStart) return;
    setWeekStart(nextWeek);
    let nextSelected = shiftDay(selectedDate, deltaWeeks * 7);
    if (nextSelected < bounds.minDay) nextSelected = bounds.minDay;
    if (nextSelected > bounds.maxDay) nextSelected = bounds.maxDay;
    setSelectedDate(nextSelected);
  };

  const jumpToToday = () => {
    setWeekStart(bounds.currentWeekStart);
    setSelectedDate(today);
  };

  const openPicker = (meal: Meal, button: HTMLButtonElement) => {
    pickerTriggerRef.current = button;
    setPickerMeal(meal);
  };

  const renderPlannedMealCards = (eatDate: string, eatLabel: string) =>
    MEALS.map((meal) => {
      const list = dayPlanEntries.filter((e) => e.meal === meal.key);
      const kcal = list.reduce((s, e) => s + (e.nutrients.calories ?? 0), 0);
      return (
        <section key={meal.key} className="card meal-card" aria-labelledby={`plan-meal-${meal.key}`}>
          <div className="meal-head">
            <h3 id={`plan-meal-${meal.key}`} className="meal-title">
              {meal.label}
            </h3>
            <span className="meal-kcal">{list.length > 0 ? `${fmt(kcal)} kcal` : ''}</span>
            {list.length > 0 && (
              <button
                type="button"
                className="secondary-btn pill-btn"
                onClick={() => onEatPlanItems(list, eatDate)}
                title={`Copy ${meal.label.toLowerCase()} to ${eatDate === today ? "today's" : formatDay(eatDate, today)} log`}
              >
                <Check size={13} aria-hidden="true" />
                {eatLabel}
              </button>
            )}
            <button
              type="button"
              className="secondary-btn icon-btn"
              aria-label={`Plan food for ${meal.label}`}
              onClick={(e) => openPicker(meal.key, e.currentTarget)}
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>
          {list.length === 0 ? (
            <p className="meal-empty">Nothing planned.</p>
          ) : (
            <ul className="entry-list">
              {list.map((item) => (
                <li key={item.id} className="entry-row">
                  <div className="entry-main">
                    <span className="entry-name">{item.name}</span>
                    <span className="entry-meta">
                      {item.amountText}
                      {item.nutrients.protein != null && ` · P ${fmt(item.nutrients.protein, 1)}`}
                      {item.nutrients.carbs != null && ` · C ${fmt(item.nutrients.carbs, 1)}`}
                      {item.nutrients.fat != null && ` · F ${fmt(item.nutrients.fat, 1)}`}
                    </span>
                  </div>
                  <span className="entry-kcal">{fmt(item.nutrients.calories)}</span>
                  <button
                    type="button"
                    className="ghost-btn icon-btn"
                    aria-label={`${eatLabel}: ${item.name}`}
                    title={eatLabel}
                    onClick={() => onEatPlanItems([item], eatDate)}
                  >
                    <Check size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="ghost-btn icon-btn"
                    aria-label={`Remove planned ${item.name}`}
                    title="Remove"
                    onClick={() => onDeletePlanItem(item)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    });

  return (
    <div className="view">
      <div className="week-nav">
        <button
          type="button"
          className="secondary-btn icon-btn"
          aria-label="Previous week"
          disabled={weekStart <= bounds.minWeekStart}
          onClick={() => shiftWeek(-1)}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <h2 className="week-title" aria-live="polite">
          {formatWeekRange(weekStart, today)}
        </h2>
        <button
          type="button"
          className="secondary-btn icon-btn"
          aria-label="Next week"
          disabled={weekStart >= bounds.maxWeekStart}
          onClick={() => shiftWeek(1)}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        {(weekStart !== bounds.currentWeekStart || selectedDate !== today) && (
          <button type="button" className="secondary-btn day-today-btn" onClick={jumpToToday}>
            Today
          </button>
        )}
      </div>

      <section className="card week-card" aria-label="Week calendar">
        <div className="week-grid" role="group" aria-label="Days in week">
          {daysInWeek.map((d) => {
            const inWindow = d >= bounds.minDay && d <= bounds.maxDay;
            const cellIsFuture = d > today;
            const cellIsToday = d === today;
            const cellSelected = d === selectedDate;
            const summary = cellIsFuture ? planByDate.get(d) : logByDate.get(d);
            const hasPlanOnToday = cellIsToday && (planByDate.get(d)?.count ?? 0) > 0;
            const kcal = summary?.kcal ?? 0;
            const hasItems = (summary?.count ?? 0) > 0;
            const cellOver = target != null && hasItems && kcal > target;
            const fillPct = target && hasItems ? Math.min(100, (kcal / target) * 100) : hasItems ? 100 : 0;
            const stateText = !inWindow
              ? 'outside 60-day history'
              : cellIsFuture
                ? hasItems
                  ? `${Math.round(kcal)} kcal planned`
                  : 'nothing planned'
                : hasItems
                  ? `${Math.round(kcal)} kcal eaten`
                  : 'nothing logged';
            const dayLabel = formatDay(d, today);
            const longLabel = formatLongDay(d, today);
            const dateLabel = dayLabel === longLabel ? dayLabel : `${dayLabel}, ${longLabel}`;

            return (
              <button
                key={d}
                type="button"
                disabled={!inWindow}
                aria-pressed={cellSelected}
                aria-label={`${dateLabel}, ${stateText}`}
                className={[
                  'week-cell',
                  cellSelected ? 'is-selected' : '',
                  cellIsToday ? 'is-today' : '',
                  cellIsFuture ? 'is-future' : '',
                  !inWindow ? 'is-outside' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSelectedDate(d)}
              >
                <span className="week-cell-dow">{shortWeekday(d)}</span>
                <span className="week-cell-num">{dayOfMonth(d)}</span>
                <span className={`week-cell-kcal ${cellOver ? 'is-over' : ''}`}>
                  {inWindow && hasItems ? fmtCellKcal(kcal) : '–'}
                </span>
                <span className="week-cell-tag" aria-hidden="true">
                  {inWindow && cellIsFuture && hasItems ? 'plan' : hasPlanOnToday ? '+plan' : ''}
                </span>
                <span className="week-cell-bar" aria-hidden="true">
                  {inWindow && hasItems && (
                    <span
                      className={`week-cell-fill ${cellIsFuture ? 'is-planned' : ''} ${cellOver ? 'is-over' : ''}`}
                      style={{ width: `${fillPct}%` }}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="plan-day-head">
        <div className="plan-day-title-wrap">
          <h3 className="plan-day-title">{formatDay(selectedDate, today)}</h3>
          {(isToday || selectedDate === shiftDay(today, -1) || selectedDate === shiftDay(today, 1)) && (
            <span className="muted small">{formatLongDay(selectedDate, today)}</span>
          )}
          <span className={`plan-status-badge ${isFuture ? 'is-planned' : 'is-logged'}`}>
            {isFuture ? 'Planned · not eaten' : 'Logged'}
          </span>
        </div>
        {!isFuture && (
          <button type="button" className="secondary-btn pill-btn" onClick={() => onOpenDay(selectedDate)}>
            <ExternalLink size={13} aria-hidden="true" />
            Open in Today
          </button>
        )}
      </div>

      <section className="card summary-card" aria-label={isFuture ? 'Planned calories' : 'Logged calories'}>
        <div className="summary-top">
          <div>
            <p className="summary-kicker">{isFuture ? 'Planned (not eaten)' : 'Eaten'}</p>
            <p className="summary-big">
              {fmt(activeKcal)} <span className="summary-unit">kcal</span>
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
            className={`progress ${isFuture ? 'is-planned' : ''} ${over ? 'is-over' : ''}`}
            role="progressbar"
            aria-label={isFuture ? 'Planned calories against target' : 'Calories eaten against target'}
            aria-valuemin={0}
            aria-valuemax={target}
            aria-valuenow={Math.round(activeKcal)}
          >
            <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
        <MacroSummary totals={activeTotals} />
        <p className="summary-extra">
          Fiber {fmt(activeTotals.fiber, 1)} g · Sugars {fmt(activeTotals.sugar, 1)} g · Sodium {fmt(activeTotals.sodium)} mg
        </p>
        {isToday && dayPlanEntries.length > 0 && (
          <p className="plan-today-note">
            Planned for today: {fmt(planTotals.calories ?? 0)} kcal (not counted as eaten until logged).
          </p>
        )}
      </section>

      {isPast && (
        <>
          {dayLogEntries.length === 0 ? (
            <section className="card empty-card">
              <CalendarDays size={24} aria-hidden="true" />
              <p>Nothing logged on {formatDay(selectedDate, today)}.</p>
              <button type="button" className="secondary-btn" onClick={() => onOpenDay(selectedDate)}>
                Open in Today
              </button>
            </section>
          ) : (
            MEALS.map((meal) => {
              const list = dayLogEntries.filter((e) => e.meal === meal.key);
              if (list.length === 0) return null;
              const kcal = list.reduce((s, e) => s + (e.nutrients.calories ?? 0), 0);
              return (
                <section key={meal.key} className="card meal-card" aria-labelledby={`past-meal-${meal.key}`}>
                  <div className="meal-head">
                    <h3 id={`past-meal-${meal.key}`} className="meal-title">
                      {meal.label}
                    </h3>
                    <span className="meal-kcal">{fmt(kcal)} kcal</span>
                  </div>
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
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
          {dayPlanEntries.length > 0 && (
            <section className="card plan-section-full" aria-labelledby="past-planned-title">
              <div className="card-head">
                <h3 id="past-planned-title" className="card-title">
                  Planned (not logged)
                </h3>
                <span className="muted small">{fmt(planTotals.calories ?? 0)} kcal</span>
              </div>
              <ul className="entry-list">
                {dayPlanEntries.map((item) => (
                  <li key={item.id} className="entry-row">
                    <div className="entry-main">
                      <span className="entry-name">{item.name}</span>
                      <span className="entry-meta">
                        {MEALS.find((m) => m.key === item.meal)?.label} · {item.amountText}
                      </span>
                    </div>
                    <span className="entry-kcal">{fmt(item.nutrients.calories)}</span>
                    <button
                      type="button"
                      className="ghost-btn icon-btn"
                      aria-label={`I ate this: ${item.name}`}
                      title="I ate this"
                      onClick={() => onEatPlanItems([item], selectedDate)}
                    >
                      <Check size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="ghost-btn icon-btn"
                      aria-label={`Remove planned ${item.name}`}
                      onClick={() => onDeletePlanItem(item)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {isToday && (
        <>
          <div className="plan-section-heading">
            <h3 className="plan-subheading">Planned for today</h3>
            <span className="muted small">Tap I ate this to copy into Today’s log</span>
          </div>
          {renderPlannedMealCards(today, 'I ate this')}
          {dayLogEntries.length > 0 && (
            <section className="card plan-section-full" aria-labelledby="today-logged-summary">
              <div className="card-head">
                <h3 id="today-logged-summary" className="card-title">
                  Logged today
                </h3>
                <button type="button" className="secondary-btn pill-btn" onClick={() => onOpenDay(today)}>
                  Open in Today
                </button>
              </div>
              <ul className="entry-list">
                {dayLogEntries.map((e) => (
                  <li key={e.id} className="entry-row">
                    <div className="entry-main">
                      <span className="entry-name">{e.name}</span>
                      <span className="entry-meta">
                        {MEALS.find((m) => m.key === e.meal)?.label} · {e.amountText}
                      </span>
                    </div>
                    <span className="entry-kcal">{fmt(e.nutrients.calories)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {isFuture && renderPlannedMealCards(today, 'Ate today')}

      {olderCount > 0 && (
        <p className="plan-retention-note muted small">
          Showing the last 60 days. {olderCount} older {olderCount === 1 ? 'log entry stays' : 'log entries stay'} saved on this device and in backups.
        </p>
      )}

      <PlanFoodModal
        open={pickerMeal !== null}
        date={selectedDate}
        initialMeal={pickerMeal ?? 'breakfast'}
        foods={foods}
        onClose={() => setPickerMeal(null)}
        onSave={onAddPlanItem}
        onGoToAdd={onOpenAdd}
        restoreFocusRef={pickerTriggerRef}
      />
    </div>
  );
};
