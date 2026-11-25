import { useCallback, useEffect, useRef, useState } from 'react'
import AboutModal from './components/AboutModal'
import Header from './components/Header'
import HelpModal from './components/HelpModal'
import IncomeSection from './components/IncomeSection'
import TaxesSection from './components/TaxesSection'
import ExpensesSection from './components/ExpensesSection'
import PlanningTab from './components/PlanningTab'
import SideMenu, { type PendingWadImport } from './components/SideMenu'
import type { Timeframe, MobileTab, DesktopView, TaxRow, ExpenseRow, IncomeRow, PlanState } from './types'
import { convertValue } from './utils'
import { buildWadBackup, downloadWadBackup, parseWadImport } from './backupUtils'
import { loadBudgetState, loadPlanState, saveBudgetState, savePlanState } from './storage'
import { registerServiceWorker } from './pwa'
import { useMediaQuery } from './useMediaQuery'

const MOBILE_TABS: MobileTab[] = ['income', 'taxes', 'expenses', 'planning']
const SWIPE_MIN_PX = 40

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function App() {
  const [initialBudget] = useState(() => loadBudgetState())
  const [timeframe, setTimeframe] = useState<Timeframe>(initialBudget.timeframe)
  const [incomeRows, setIncomeRows] = useState<IncomeRow[]>(initialBudget.incomeRows)
  const [taxes, setTaxes] = useState<TaxRow[]>(initialBudget.taxes)
  const [expenses, setExpenses] = useState<ExpenseRow[]>(initialBudget.expenses)
  const [plan, setPlan] = useState<PlanState>(() => loadPlanState())

  const [mobileTab, setMobileTab] = useState<MobileTab>('income')
  const [desktopView, setDesktopView] = useState<DesktopView>('budget')
  const [menuOpen, setMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const isPhone = useMediaQuery('(max-width: 767px)')
  const swipeStart = useRef<{ x: number; y: number; id: number } | null>(null)
  const suppressNavClick = useRef(false)

  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const closeHelp = useCallback(() => setHelpOpen(false), [])
  const closeAbout = useCallback(() => setAboutOpen(false), [])
  const showToast = useCallback((msg: string) => setToast(msg), [])

  useEffect(() => {
    saveBudgetState({ timeframe, incomeRows, taxes, expenses })
  }, [timeframe, incomeRows, taxes, expenses])

  useEffect(() => {
    savePlanState(plan)
  }, [plan])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    void registerServiceWorker()
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    const onAppInstalled = () => {
      setInstallPrompt(null)
      showToast('Wad installed')
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [showToast])

  // Phones: swipe sideways on the bottom tab bar only (no wraparound)
  const onNavPointerDown = (e: React.PointerEvent) => {
    if (!isPhone || !e.isPrimary) return
    swipeStart.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
  }

  const onNavPointerUp = (e: React.PointerEvent) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!isPhone || !start || start.id !== e.pointerId) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return
    suppressNavClick.current = true
    window.setTimeout(() => {
      suppressNavClick.current = false
    }, 400)
    setMobileTab((current) => {
      const i = MOBILE_TABS.indexOf(current)
      const next = dx < 0 ? i + 1 : i - 1
      return next >= 0 && next < MOBILE_TABS.length ? MOBILE_TABS[next] : current
    })
  }

  const onNavClickCapture = (e: React.MouseEvent) => {
    if (!suppressNavClick.current) return
    suppressNavClick.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  const totalIncome = incomeRows.reduce((sum, row) => {
    if (row.timeframe === 'hourly') {
      return sum + convertValue(row.amount * row.hoursPerWeek, 'weekly', timeframe, 0)
    }
    return sum + convertValue(row.amount, row.timeframe, timeframe, 0)
  }, 0)
  const totalTaxes = taxes.reduce((sum, t) => {
    return sum + (t.mode === 'percent' ? (totalIncome * t.value) / 100 : t.value)
  }, 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + Math.abs(e.amount), 0)
  const netIncome = totalIncome - totalTaxes - totalExpenses

  function handleTimeframeChange(newTimeframe: Timeframe) {
    if (newTimeframe === timeframe) return
    const convert = (v: number) => convertValue(v, timeframe, newTimeframe, 0)
    setTaxes(prev =>
      prev.map(t => ({ ...t, value: t.mode === 'dollar' ? convert(t.value) : t.value }))
    )
    setExpenses(prev => prev.map(e => ({ ...e, amount: convert(e.amount) })))
    setTimeframe(newTimeframe)
  }

  function handleExport() {
    downloadWadBackup(buildWadBackup({ timeframe, incomeRows, taxes, expenses }, plan))
    showToast('Backup exported.')
  }

  function handleValidateImport(
    rawText: string
  ): { ok: true; pending: PendingWadImport } | { ok: false; error: string } {
    const parsed = parseWadImport(rawText)
    if (!parsed.ok) return parsed
    const { data } = parsed
    const rows = data.incomeRows.length + data.expenses.length
    const summary = rows === 1 ? '1 income/expense entry' : `${rows} income & expense entries`
    return {
      ok: true,
      pending: {
        summary,
        apply: () => {
          setTimeframe(data.timeframe)
          setIncomeRows(data.incomeRows)
          setTaxes(data.taxes)
          setExpenses(data.expenses)
          if (data.plan) {
            setPlan(data.plan)
          }
          showToast('Saved data replaced from backup.')
        },
      },
    }
  }

  const handleInstallClick = async () => {
    if (installPrompt) {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setInstallPrompt(null)
        showToast('Wad installed')
      }
      return
    }
    showToast('To install: open your browser menu and choose “Add to Home screen” or “Install app”.')
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 flex flex-col">
      {toast && (
        <div
          role="status"
          className="fixed top-[74px] left-1/2 -translate-x-1/2 z-[60] max-w-[calc(100%-32px)] px-3.5 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs font-medium text-gray-900 dark:text-neutral-100 shadow-lg"
        >
          {toast}
        </div>
      )}

      <div className="sticky top-0 z-40 shadow-sm">
        <Header
          income={totalIncome}
          totalTaxes={totalTaxes}
          totalExpenses={totalExpenses}
          netIncome={netIncome}
          timeframe={timeframe}
          menuOpen={menuOpen}
          menuId="wad-side-menu"
          menuButtonRef={menuButtonRef}
          onOpenMenu={() => setMenuOpen(true)}
          onInstall={() => void handleInstallClick()}
        />

        {/* Desktop tab bar (>= 768px) */}
        <nav aria-label="Primary navigation" className="hidden md:flex border-b border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900">
          <div className="max-w-4xl mx-auto w-full px-4 flex">
            <button
              type="button"
              onClick={() => setDesktopView('budget')}
              aria-current={desktopView === 'budget' ? 'page' : undefined}
              className={`py-3 px-6 font-semibold text-sm transition-colors cursor-pointer border-b-2 flex items-center gap-2 ${desktopView === 'budget'
                ? 'text-accent border-accent'
                : 'text-gray-500 dark:text-neutral-400 border-transparent hover:text-accent'
                }`}
            >
              <img src={`${import.meta.env.BASE_URL}budget.png`} alt="" className="h-5 w-5 object-contain" />
              Budget
            </button>
            <button
              type="button"
              onClick={() => setDesktopView('planning')}
              aria-current={desktopView === 'planning' ? 'page' : undefined}
              className={`py-3 px-6 font-semibold text-sm transition-colors cursor-pointer border-b-2 flex items-center gap-2 ${desktopView === 'planning'
                ? 'text-accent border-accent'
                : 'text-gray-500 dark:text-neutral-400 border-transparent hover:text-accent'
                }`}
            >
              <img src={`${import.meta.env.BASE_URL}plan.png`} alt="" className="h-5 w-5 object-contain" />
              Plan
            </button>
          </div>
        </nav>
      </div>

      <main className="wad-main flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-8">

        {/* Desktop: Budget wrapper — mirrors the Plan section structure */}
        <section
          className={`hidden bg-gray-50 dark:bg-neutral-900 rounded-lg p-6 border border-gray-200 dark:border-neutral-700
            ${desktopView === 'budget' ? 'md:block' : 'md:hidden'}`}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-accent text-xl font-bold flex items-center gap-2">
              <img src={`${import.meta.env.BASE_URL}budget.png`} alt="" className="h-9 w-9 object-contain" />
              Budget
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-neutral-400 font-semibold">Per</span>
              <select
                value={timeframe}
                onChange={e => handleTimeframeChange(e.target.value as Timeframe)}
                aria-label="Budget display period"
                className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 text-xs font-semibold px-2 py-1.5 cursor-pointer focus:outline-none"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 border border-gray-200 dark:border-neutral-700">
              <h3 className="text-money text-lg font-bold mb-4 flex items-center gap-2">
                <img src={`${import.meta.env.BASE_URL}income.png`} alt="" className="h-7 w-7 object-contain" />
                Income
              </h3>
              <IncomeSection
                incomeRows={incomeRows}
                setIncomeRows={setIncomeRows}
                timeframe={timeframe}
                totalIncome={totalIncome}
              />
            </div>
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 border border-gray-200 dark:border-neutral-700">
              <h3 className="text-danger text-lg font-bold mb-4 flex items-center gap-2">
                <img src={`${import.meta.env.BASE_URL}tax.png`} alt="" className="h-7 w-7 object-contain" />
                Taxes
              </h3>
              <TaxesSection
                taxes={taxes}
                setTaxes={setTaxes}
                income={totalIncome}
              />
            </div>
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 border border-gray-200 dark:border-neutral-700">
              <h3 className="text-danger text-lg font-bold mb-4 flex items-center gap-2">
                <img src={`${import.meta.env.BASE_URL}expenses.png`} alt="" className="h-7 w-7 object-contain" />
                Expenses
              </h3>
              <ExpensesSection
                expenses={expenses}
                setExpenses={setExpenses}
              />
            </div>
          </div>
        </section>

        {/* Mobile: Individual budget sections (hidden on desktop) */}
        <section
          className={`md:hidden bg-gray-50 dark:bg-neutral-900 rounded-lg p-6 border border-gray-200 dark:border-neutral-700
            ${mobileTab === 'income' ? 'block' : 'hidden'}`}
        >
          <h2 className="text-money text-xl font-bold mb-4 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <img src={`${import.meta.env.BASE_URL}income.png`} alt="" className="h-9 w-9 object-contain" />
              Income
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-neutral-400 font-semibold">Per</span>
              <select
                value={timeframe}
                onChange={e => handleTimeframeChange(e.target.value as Timeframe)}
                aria-label="Income display period"
                className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 text-xs font-semibold px-2 py-1.5 cursor-pointer focus:outline-none"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </h2>
          <IncomeSection
            incomeRows={incomeRows}
            setIncomeRows={setIncomeRows}
            timeframe={timeframe}
            totalIncome={totalIncome}
          />
        </section>

        <section
          className={`md:hidden bg-gray-50 dark:bg-neutral-900 rounded-lg p-6 border border-gray-200 dark:border-neutral-700
            ${mobileTab === 'taxes' ? 'block' : 'hidden'}`}
        >
          <h2 className="text-danger text-xl font-bold mb-4 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <img src={`${import.meta.env.BASE_URL}tax.png`} alt="" className="h-9 w-9 object-contain" />
              Taxes
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-neutral-400 font-semibold">Per</span>
              <select
                value={timeframe}
                onChange={e => handleTimeframeChange(e.target.value as Timeframe)}
                aria-label="Taxes display period"
                className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 text-xs font-semibold px-2 py-1.5 cursor-pointer focus:outline-none"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </h2>
          <TaxesSection
            taxes={taxes}
            setTaxes={setTaxes}
            income={totalIncome}
          />
        </section>

        <section
          className={`md:hidden bg-gray-50 dark:bg-neutral-900 rounded-lg p-6 border border-gray-200 dark:border-neutral-700
            ${mobileTab === 'expenses' ? 'block' : 'hidden'}`}
        >
          <h2 className="text-danger text-xl font-bold mb-4 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <img src={`${import.meta.env.BASE_URL}expenses.png`} alt="" className="h-9 w-9 object-contain" />
              Expenses
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-neutral-400 font-semibold">Per</span>
              <select
                value={timeframe}
                onChange={e => handleTimeframeChange(e.target.value as Timeframe)}
                aria-label="Expenses display period"
                className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 text-xs font-semibold px-2 py-1.5 cursor-pointer focus:outline-none"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </h2>
          <ExpensesSection
            expenses={expenses}
            setExpenses={setExpenses}
          />
        </section>

        {/* Plan section */}
        <section
          className={`bg-gray-50 dark:bg-neutral-900 rounded-lg p-6 border border-gray-200 dark:border-neutral-700
            ${mobileTab === 'planning' ? 'block' : 'hidden'}
            ${desktopView === 'planning' ? 'md:block' : 'md:hidden'}`}
        >
          <h2 className="text-accent text-xl font-bold mb-4 flex items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}plan.png`} alt="" className="h-9 w-9 object-contain" />
            Plan
          </h2>
          <PlanningTab plan={plan} onChangePlan={setPlan} />
        </section>
      </main>

      {/* Mobile bottom tab bar (< 768px) */}
      <nav
        aria-label="Primary navigation"
        onPointerDown={onNavPointerDown}
        onPointerUp={onNavPointerUp}
        onPointerCancel={() => { swipeStart.current = null }}
        onClickCapture={onNavClickCapture}
        className="wad-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t border-gray-200 dark:border-neutral-700 bg-gray-50/95 dark:bg-neutral-900/95 backdrop-blur-md"
      >
        {([
          { id: 'income' as MobileTab, label: 'Income', icon: `${import.meta.env.BASE_URL}income.png`, activeClass: 'text-money border-t-2 border-money' },
          { id: 'taxes' as MobileTab, label: 'Taxes', icon: `${import.meta.env.BASE_URL}tax.png`, activeClass: 'text-danger border-t-2 border-danger' },
          { id: 'expenses' as MobileTab, label: 'Expenses', icon: `${import.meta.env.BASE_URL}expenses.png`, activeClass: 'text-danger border-t-2 border-danger' },
          { id: 'planning' as MobileTab, label: 'Plan', icon: `${import.meta.env.BASE_URL}plan.png`, activeClass: 'text-accent border-t-2 border-accent' },
        ]).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobileTab(tab.id)}
            aria-current={mobileTab === tab.id ? 'page' : undefined}
            className={`flex-1 py-2 flex flex-col items-center gap-0.5 font-semibold transition-colors cursor-pointer ${mobileTab === tab.id ? tab.activeClass : 'text-gray-500 dark:text-neutral-400 border-t-2 border-transparent'
              }`}
          >
            <img src={tab.icon} alt="" className="h-7 w-7 object-contain" />
            <span className="text-xs">{tab.label}</span>
          </button>
        ))}
      </nav>

      <SideMenu
        id="wad-side-menu"
        open={menuOpen}
        onClose={closeMenu}
        restoreFocusRef={menuButtonRef}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
        onInstall={() => void handleInstallClick()}
        onExport={handleExport}
        onValidateImport={handleValidateImport}
      />
      <HelpModal open={helpOpen} onClose={closeHelp} restoreFocusRef={menuButtonRef} />
      <AboutModal open={aboutOpen} onClose={closeAbout} restoreFocusRef={menuButtonRef} />
    </div>
  )
}
