import type { RefObject } from 'react'
import { formatCurrency } from '../utils'
import type { Timeframe } from '../types'
import { TIMEFRAME_LABELS } from '../types'

interface HeaderProps {
    income: number
    totalTaxes: number
    totalExpenses: number
    netIncome: number
    timeframe: Timeframe
    menuOpen: boolean
    menuId: string
    menuButtonRef: RefObject<HTMLButtonElement | null>
    onOpenMenu: () => void
    onInstall: () => void
}

function WadMark() {
    return (
        <img
            src={`${import.meta.env.BASE_URL}wad-icon.png`}
            alt=""
            className="w-8 h-8 md:w-9 md:h-9 block"
            width={36}
            height={36}
        />
    )
}

function InstallIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" x2="12" y1="15" y2="3" />
        </svg>
    )
}

export default function Header({
    income,
    totalTaxes,
    totalExpenses,
    netIncome,
    timeframe,
    menuOpen,
    menuId,
    menuButtonRef,
    onOpenMenu,
    onInstall,
}: HeaderProps) {
    const period = TIMEFRAME_LABELS[timeframe]
    const isNegative = netIncome < 0

    return (
        <header className="bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-700">
            <div className="max-w-4xl mx-auto px-2.5 sm:px-4 py-1.5 flex items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr] gap-2 md:gap-4">

                {/* Left: Menu button + Wad icon + name */}
                <div className="flex items-center gap-2 shrink-0 md:justify-self-start">
                    <button
                        ref={menuButtonRef}
                        type="button"
                        aria-label="Open menu"
                        aria-expanded={menuOpen}
                        aria-controls={menuId}
                        onClick={onOpenMenu}
                        className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-gray-800 dark:text-neutral-100 hover:bg-gray-200/60 dark:hover:bg-neutral-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="4" x2="20" y1="6" y2="6" />
                            <line x1="4" x2="20" y1="12" y2="12" />
                            <line x1="4" x2="20" y1="18" y2="18" />
                        </svg>
                    </button>
                    <span className="inline-flex w-8 h-8 md:w-9 md:h-9 items-center justify-center">
                        <WadMark />
                    </span>
                    <h1 className="text-lg md:text-xl font-bold tracking-tight leading-none">Wad</h1>
                </div>

                {/* Desktop Center: Net income */}
                <div className="hidden md:block text-center py-3 min-w-0">
                    <div className={`text-4xl font-bold tabular-nums ${isNegative ? 'text-danger' : 'text-money'}`}>
                        {formatCurrency(netIncome)}
                        <span className="text-base text-gray-500 dark:text-neutral-400 font-normal ml-2 whitespace-nowrap">/ {period}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-0.5 text-xs text-gray-500 dark:text-neutral-400 justify-center">
                        <span>Gross: <span className="text-money font-medium">{formatCurrency(income)}</span></span>
                        <span>Taxes: <span className="text-danger font-medium">{formatCurrency(totalTaxes)}</span></span>
                        <span>Expenses: <span className="text-danger font-medium">{formatCurrency(totalExpenses)}</span></span>
                    </div>
                </div>

                {/* Right: Install button (both mobile & desktop) */}
                <div className="md:justify-self-end">
                    <button
                        type="button"
                        onClick={onInstall}
                        title="Install Wad"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold text-gray-800 dark:text-neutral-100 hover:border-gray-400 dark:hover:border-neutral-600 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        <InstallIcon />
                        <span>Install</span>
                    </button>
                </div>
            </div>

            {/* Mobile net income & sub-values row */}
            <div className="md:hidden px-3 pb-2 text-center">
                <div className={`text-2xl font-bold tabular-nums ${isNegative ? 'text-danger' : 'text-money'}`}>
                    {formatCurrency(netIncome)}
                    <span className="text-sm text-gray-500 dark:text-neutral-400 font-normal ml-1.5 whitespace-nowrap">/ {period}</span>
                </div>
                <div className="flex justify-around mt-0.5 text-xs text-gray-500 dark:text-neutral-400">
                    <span>Gross: <span className="text-money font-medium">{formatCurrency(income)}</span></span>
                    <span>Taxes: <span className="text-danger font-medium">{formatCurrency(totalTaxes)}</span></span>
                    <span>Expenses: <span className="text-danger font-medium">{formatCurrency(totalExpenses)}</span></span>
                </div>
            </div>
        </header>
    )
}
