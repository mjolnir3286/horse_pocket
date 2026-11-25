import { useCallback, useRef, useState } from 'react'
import AboutModal from './components/AboutModal'
import Header from './components/Header'
import HelpModal from './components/HelpModal'
import IncomeSection from './components/IncomeSection'
import TaxesSection from './components/TaxesSection'
import ExpensesSection from './components/ExpensesSection'
import PlanningTab from './components/PlanningTab'
import SideMenu, { type PendingWadImport } from './components/SideMenu'
import type { Timeframe, MobileTab, DesktopView, TaxRow, ExpenseRow, IncomeRow } from './types'
import { convertValue } from './utils'
import { buildWadBackup, downloadWadBackup, parseWadImport } from './backupUtils'

const DEFAULT_TAXES: TaxRow[] = [
  { id: 'federal', name: 'Federal Income', mode: 'dollar', value: 0 },
  { id: 'state', name: 'State Income', mode: 'dollar', value: 0 },
  { id: 'social-security', name: 'Social Security', mode: 'dollar', value: 0 },
  { id: 'medicare', name: 'Medicare', mode: 'dollar', value: 0 },
]

export default function App() {
  const [timeframe, setTimeframe] = useState<Timeframe>('monthly')
  const [incomeRows, setIncomeRows] = useState<IncomeRow[]>(() => [
    { id: crypto.randomUUID(), name: '', category: 'Payroll', amount: 0, timeframe: 'monthly', hoursPerWeek: 40 },
  ])
  const [taxes, setTaxes] = useState<TaxRow[]>(DEFAULT_TAXES)
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [mobileTab, setMobileTab] = useState<MobileTab>('income')
  const [desktopView, setDesktopView] = useState<DesktopView>('budget')
  const [menuOpen, setMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const closeHelp = useCallback(() => setHelpOpen(false), [])
  const closeAbout = useCallback(() => setAboutOpen(false), [])

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
    downloadWadBackup(buildWadBackup({ timeframe, incomeRows, taxes, expenses }))
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
        },
      },
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 flex flex-col">
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
        />

        {/* Desktop tab bar */}
        <nav className="hidden md:flex border-b border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900">
        <div className="max-w-4xl mx-auto w-full px-4 flex">
          <button
            onClick={() => setDesktopView('budget')}
            className={`py-3 px-6 font-semibold text-sm transition-colors cursor-pointer border-b-2 flex items-center gap-2 ${desktopView === 'budget'
              ? 'text-accent border-accent'
              : 'text-gray-500 dark:text-neutral-400 border-transparent hover:text-accent'
              }`}
          >
            <img src={`${import.meta.env.BASE_URL}budget.png`} alt="" className="h-5 w-5 object-contain" />
            Budget
          </button>
          <button
            onClick={() => setDesktopView('planning')}
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

        {/* Mobile tab bar */}
        <nav className="md:hidden flex border-b border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900">
        {([
          { id: 'income' as MobileTab, label: 'Income', icon: `${import.meta.env.BASE_URL}income.png`, activeClass: 'text-money border-b-2 border-money' },
          { id: 'taxes' as MobileTab, label: 'Taxes', icon: `${import.meta.env.BASE_URL}tax.png`, activeClass: 'text-danger border-b-2 border-danger' },
          { id: 'expenses' as MobileTab, label: 'Expenses', icon: `${import.meta.env.BASE_URL}expenses.png`, activeClass: 'text-danger border-b-2 border-danger' },
          { id: 'planning' as MobileTab, label: 'Plan', icon: `${import.meta.env.BASE_URL}plan.png`, activeClass: 'text-accent border-b-2 border-accent' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setMobileTab(tab.id)}
            className={`flex-1 py-2 flex flex-col items-center gap-0.5 font-semibold transition-colors cursor-pointer ${mobileTab === tab.id ? tab.activeClass : 'text-gray-500 dark:text-neutral-400'
              }`}
          >
            <img src={tab.icon} alt="" className="h-7 w-7 object-contain" />
            <span className="text-xs">{tab.label}</span>
          </button>
        ))}
        </nav>
      </div>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-8">

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
          <PlanningTab />
        </section>
      </main>

      <SideMenu
        id="wad-side-menu"
        open={menuOpen}
        onClose={closeMenu}
        restoreFocusRef={menuButtonRef}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
        onExport={handleExport}
        onValidateImport={handleValidateImport}
      />
      <HelpModal open={helpOpen} onClose={closeHelp} restoreFocusRef={menuButtonRef} />
      <AboutModal open={aboutOpen} onClose={closeAbout} restoreFocusRef={menuButtonRef} />
    </div>
  )
}
