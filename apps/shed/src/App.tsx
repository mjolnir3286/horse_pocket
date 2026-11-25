import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, History, Menu, NotebookPen, PlusCircle, UserRound } from 'lucide-react';
import { SITE } from './config/site';
import { computeEnergy, type Profile } from './lib/energy';
import {
  loadFoods,
  loadLog,
  loadProfile,
  mealForNow,
  newId,
  saveFoods,
  saveLog,
  saveProfile,
  type FoodItem,
  type LogEntry,
  type Meal,
} from './lib/storage';
import { backupFilename, buildBackup, downloadJsonFile, parseBackup } from './lib/backup';
import { dayKey } from './lib/dates';
import { registerServiceWorker, useInstallPrompt } from './lib/pwa';
import { ShedMark } from './components/ShedMark';
import { SideMenu, type PendingImport } from './components/SideMenu';
import { HelpModal } from './components/HelpModal';
import { AboutModal } from './components/AboutModal';
import { TodayView } from './components/TodayView';
import { AddView, type AddPayload } from './components/AddView';
import { HistoryView } from './components/HistoryView';
import { ProfileView } from './components/ProfileView';

type Tab = 'today' | 'add' | 'history' | 'profile';

const TABS: { key: Tab; label: string; icon: typeof NotebookPen }[] = [
  { key: 'today', label: 'Today', icon: NotebookPen },
  { key: 'add', label: 'Add', icon: PlusCircle },
  { key: 'history', label: 'History', icon: History },
  { key: 'profile', label: 'Profile', icon: UserRound },
];

const TAB_STORAGE = 'shed_tab_v1';

function initialTab(): Tab {
  const hash = window.location.hash.replace('#', '') as Tab;
  if (TABS.some((t) => t.key === hash)) return hash;
  try {
    const saved = sessionStorage.getItem(TAB_STORAGE) as Tab | null;
    if (saved && TABS.some((t) => t.key === saved)) return saved;
  } catch {
    // ignore
  }
  return 'today';
}

export default function App() {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [foods, setFoods] = useState<FoodItem[]>(loadFoods);
  const [log, setLog] = useState<LogEntry[]>(loadLog);
  const [date, setDate] = useState<string>(dayKey());
  const [meal, setMeal] = useState<Meal>(mealForNow());
  const [dataVersion, setDataVersion] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const { install, installed } = useInstallPrompt(SITE.name);

  useEffect(() => {
    void registerServiceWorker();
  }, []);

  useEffect(() => saveProfile(profile), [profile]);
  useEffect(() => saveFoods(foods), [foods]);
  useEffect(() => saveLog(log), [log]);
  useEffect(() => {
    try {
      sessionStorage.setItem(TAB_STORAGE, tab);
    } catch {
      // ignore
    }
  }, [tab]);

  // Roll "today" forward if the app stays open past midnight.
  useEffect(() => {
    let current = dayKey();
    const id = window.setInterval(() => {
      const now = dayKey();
      if (now !== current) {
        setDate((d) => (d === current ? now : d));
        current = now;
      }
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const energy = useMemo(() => computeEnergy(profile), [profile]);
  const dayEntries = useMemo(
    () => log.filter((e) => e.date === date).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [log, date]
  );

  const goTab = (next: Tab) => {
    setTab(next);
    window.scrollTo({ top: 0 });
  };

  const handleAdd = (p: AddPayload) => {
    const now = new Date().toISOString();
    // Save or update the food (match by id, else by name) so it can be re-added.
    const existing =
      foods.find((f) => f.id === p.food.id) ?? foods.find((f) => f.name.toLowerCase() === p.food.name.toLowerCase());
    const saved: FoodItem = {
      id: existing?.id ?? newId(),
      name: p.food.name,
      servingSize: p.food.servingSize,
      servingGrams: p.food.servingGrams,
      servingsPerContainer: p.food.servingsPerContainer,
      per: p.food.per,
      createdAt: existing?.createdAt ?? now,
      lastUsedAt: now,
    };
    setFoods(existing ? foods.map((f) => (f.id === existing.id ? saved : f)) : [saved, ...foods]);
    const entry: LogEntry = {
      id: newId(),
      date,
      meal: p.meal,
      foodId: saved.id,
      name: p.food.name,
      servings: p.servings,
      amountText: p.amountText,
      nutrients: p.nutrients,
      createdAt: now,
    };
    setLog((l) => [...l, entry]);
    showToast(`Added ${p.food.name} to ${p.meal}.`);
    goTab('today');
  };

  const handleDeleteEntry = (entry: LogEntry) => {
    setLog((l) => l.filter((e) => e.id !== entry.id));
    showToast(`Removed ${entry.name}.`);
  };

  const handleCopyToToday = (entry: LogEntry) => {
    const now = new Date();
    setLog((l) => [
      ...l,
      { ...entry, id: newId(), date: dayKey(now), meal: mealForNow(now), createdAt: now.toISOString() },
    ]);
    showToast(`Added ${entry.name} to today.`);
  };

  const handleDeleteFood = (food: FoodItem) => {
    setFoods((list) => list.filter((f) => f.id !== food.id));
    showToast(`Deleted ${food.name} from saved foods. Your log is unchanged.`);
  };

  const handleExport = () => {
    downloadJsonFile(buildBackup(profile, foods, log), backupFilename());
  };

  const validateImport = (raw: string): { ok: true; pending: PendingImport } | { ok: false; error: string } => {
    const res = parseBackup(raw);
    if (!res.ok) return res;
    return {
      ok: true,
      pending: {
        summary: res.summary,
        apply: () => {
          setProfile(res.backup.profile);
          setFoods(res.backup.foods);
          setLog(res.backup.log);
          setDataVersion((v) => v + 1);
        },
      },
    };
  };

  const handleInstall = async () => {
    const res = await install();
    if (res.outcome !== 'accepted') showToast(res.message);
  };

  return (
    <div className="app-shell">
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      <div className="top-chrome">
        <header className="app-header">
          <div className="header-row">
            <div className="header-left">
              <button
                ref={menuButtonRef}
                type="button"
                className="menu-btn"
                aria-label="Open menu"
                aria-expanded={menuOpen}
                aria-controls="shed-side-menu"
                onClick={() => setMenuOpen(true)}
              >
                <Menu size={20} aria-hidden="true" />
              </button>
              <div className="brand-identity">
                <span className="shed-mark">
                  <ShedMark />
                </span>
                <h1 className="brand-title">{SITE.name}</h1>
              </div>
            </div>
            {!installed && (
              <div className="header-actions">
                <button type="button" className="secondary-btn pill-btn" onClick={handleInstall} title={`Install ${SITE.name}`}>
                  <Download size={13} aria-hidden="true" />
                  Install
                </button>
              </div>
            )}
          </div>
        </header>

        <nav className="primary-nav" aria-label="Primary navigation">
          <div className="primary-nav-inner">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                className={`nav-tab ${tab === key ? 'active' : ''}`}
                aria-current={tab === key ? 'page' : undefined}
                onClick={() => goTab(key)}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>

      <main className="app-main">
        {tab === 'today' && (
          <TodayView
            date={date}
            onDateChange={setDate}
            entries={dayEntries}
            energy={energy}
            onAddToMeal={(m) => {
              setMeal(m);
              goTab('add');
            }}
            onDelete={handleDeleteEntry}
            onCopyToToday={handleCopyToToday}
            onOpenProfile={() => goTab('profile')}
          />
        )}
        {tab === 'add' && (
          <AddView date={date} meal={meal} onMealChange={setMeal} foods={foods} onAdd={handleAdd} onDeleteFood={handleDeleteFood} />
        )}
        {tab === 'history' && (
          <HistoryView
            log={log}
            target={energy?.target ?? null}
            onOpenDay={(d) => {
              setDate(d);
              goTab('today');
            }}
          />
        )}
        {tab === 'profile' && <ProfileView key={dataVersion} profile={profile} onChange={setProfile} />}
      </main>

      <SideMenu
        id="shed-side-menu"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        restoreFocusRef={menuButtonRef}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
        onInstall={handleInstall}
        installed={installed}
        onExport={handleExport}
        onValidateImport={validateImport}
      />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} restoreFocusRef={menuButtonRef} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} restoreFocusRef={menuButtonRef} />
    </div>
  );
}
