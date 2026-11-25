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
}: HeaderProps) {
    const period = TIMEFRAME_LABELS[timeframe]
    const isNegative = netIncome < 0

    return (
        <header className="bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-700">
            <div className="max-w-4xl mx-auto px-2.5 sm:px-4 py-1.5 grid grid-cols-[auto_1fr] md:grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-4">

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

                {/* Center / Right on narrow screens: Net income */}
                <div className="text-right md:text-center py-2 md:py-3 min-w-0 pr-1 md:pr-0">
                    <div className={`text-xl sm:text-2xl md:text-4xl font-bold tabular-nums ${isNegative ? 'text-danger' : 'text-money'}`}>
                        {formatCurrency(netIncome)}
                        <span className="text-sm md:text-base text-gray-500 dark:text-neutral-400 font-normal ml-2 whitespace-nowrap">/ {period}</span>
                    </div>
                    {/* Sub-values: desktop only — mobile gets its own row below */}
                    <div className="hidden md:flex flex-wrap gap-4 mt-0.5 text-xs text-gray-500 dark:text-neutral-400 justify-center">
                        <span>Gross: <span className="text-money font-medium">{formatCurrency(income)}</span></span>
                        <span>Taxes: <span className="text-danger font-medium">{formatCurrency(totalTaxes)}</span></span>
                        <span>Expenses: <span className="text-danger font-medium">{formatCurrency(totalExpenses)}</span></span>
                    </div>
                </div>

                {/* Desktop right spacer so net income sits centered */}
                <div className="hidden md:block" aria-hidden="true" />
            </div>

            {/* Mobile sub-values row */}
            <div className="md:hidden flex justify-around px-4 pb-2 text-xs text-gray-500 dark:text-neutral-400">
                <span>Gross: <span className="text-money font-medium">{formatCurrency(income)}</span></span>
                <span>Taxes: <span className="text-danger font-medium">{formatCurrency(totalTaxes)}</span></span>
                <span>Expenses: <span className="text-danger font-medium">{formatCurrency(totalExpenses)}</span></span>
            </div>
        </header>
    )
}
