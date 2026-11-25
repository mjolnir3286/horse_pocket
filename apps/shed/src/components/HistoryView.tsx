import React, { useMemo } from 'react';
import { ChevronRight, History } from 'lucide-react';
import type { LogEntry } from '../lib/storage';
import { dayKey, formatDay } from '../lib/dates';

interface HistoryViewProps {
  log: LogEntry[];
  target: number | null;
  onOpenDay: (date: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ log, target, onOpenDay }) => {
  const today = dayKey();
  const days = useMemo(() => {
    const map = new Map<string, { kcal: number; protein: number; carbs: number; fat: number; count: number }>();
    for (const e of log) {
      const d = map.get(e.date) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, count: 0 };
      d.kcal += e.nutrients.calories ?? 0;
      d.protein += e.nutrients.protein ?? 0;
      d.carbs += e.nutrients.carbs ?? 0;
      d.fat += e.nutrients.fat ?? 0;
      d.count += 1;
      map.set(e.date, d);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [log]);

  if (days.length === 0) {
    return (
      <div className="view">
        <div className="card empty-card">
          <History size={28} aria-hidden="true" />
          <p>No days logged yet. Foods you add show up here by day.</p>
        </div>
      </div>
    );
  }

  const max = Math.max(target ?? 0, ...days.map(([, d]) => d.kcal), 1);

  return (
    <div className="view">
      <h2 className="view-title">History</h2>
      <ul className="history-list">
        {days.map(([date, d]) => {
          const over = target != null && d.kcal > target;
          return (
            <li key={date}>
              <button type="button" className="card history-row" onClick={() => onOpenDay(date)}>
                <div className="history-main">
                  <span className="history-day">{formatDay(date, today)}</span>
                  <span className="history-meta">
                    {d.count} {d.count === 1 ? 'item' : 'items'} · P {Math.round(d.protein)} · C {Math.round(d.carbs)} · F{' '}
                    {Math.round(d.fat)}
                  </span>
                  <span className="history-bar" aria-hidden="true">
                    <span className={`history-bar-fill ${over ? 'is-over' : ''}`} style={{ width: `${(d.kcal / max) * 100}%` }} />
                    {target != null && <span className="history-bar-target" style={{ left: `${(target / max) * 100}%` }} />}
                  </span>
                </div>
                <span className={`history-kcal ${over ? 'is-over' : ''}`}>
                  {Math.round(d.kcal).toLocaleString()}
                  <small> kcal</small>
                </span>
                <ChevronRight size={18} aria-hidden="true" className="history-chevron" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
