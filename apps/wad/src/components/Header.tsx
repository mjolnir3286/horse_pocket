import { formatCurrency } from '../utils'
import type { Timeframe } from '../types'
import { TIMEFRAME_LABELS } from '../types'

interface HeaderProps {
    income: number
    totalTaxes: number
    totalExpenses: number
    netIncome: number
    timeframe: Timeframe
    onExport: () => void
    onImportClick: () => void
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
    onExport,
    onImportClick,
}: HeaderProps) {
    const period = TIMEFRAME_LABELS[timeframe]
    const isNegative = netIncome < 0

    return (
        <header className="sticky top-0 z-50 bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-700 shadow-sm">
            <div className="max-w-4xl mx-auto px-2.5 sm:px-4 py-1.5 grid grid-cols-[auto_1fr_auto] items-center gap-1.5 sm:gap-2 md:gap-4">

                {/* Left: Wad icon + name */}
                <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex w-8 h-8 md:w-9 md:h-9 items-center justify-center">
                        <WadMark />
                    </span>
                    <h1 className="text-lg md:text-xl font-bold tracking-tight leading-none">Wad</h1>
                </div>

                {/* Center: Net income */}
                <div className="text-center py-2 md:py-3 min-w-0">
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

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 py-2">
                    <button
                        onClick={onExport}
                        className="px-2 sm:px-3 py-1.5 sm:py-2 rounded text-xs font-semibold text-gray-500 dark:text-neutral-400 border border-gray-200 dark:border-neutral-700 hover:text-money hover:border-money transition-colors cursor-pointer"
                        title="Export to CSV"
                    >
                        Export
                    </button>
                    <button
                        onClick={onImportClick}
                        className="px-2 sm:px-3 py-1.5 sm:py-2 rounded text-xs font-semibold text-gray-500 dark:text-neutral-400 border border-gray-200 dark:border-neutral-700 hover:text-accent hover:border-accent transition-colors cursor-pointer"
                        title="Import CSV"
                    >
                        Import
                    </button>
                </div>
            </div>

            {/* Subdued back-to-portal row */}
            <div className="max-w-4xl mx-auto px-2.5 sm:px-4 flex items-center justify-between">
                <a
                    href="https://mjolnir3286.github.io/horse_pocket/"
                    aria-label="Back to Horse Pocket"
                    className="inline-flex items-center min-h-8 px-1 text-xs font-medium text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                    ‹ Horse Pocket
                </a>
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
