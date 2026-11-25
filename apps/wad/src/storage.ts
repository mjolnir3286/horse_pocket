import type { BudgetData } from './csvUtils'
import {
    DEFAULT_PLAN_STATE,
    DEFAULT_TAXES,
    INCOME_CATEGORIES,
    type CompoundFreq,
    type ContribFreq,
    type ExpenseRow,
    type IncomeCategory,
    type IncomeRow,
    type PlanState,
    type TaxRow,
    type Timeframe,
} from './types'

export const BUDGET_STORAGE_KEY = 'wad_budget_v1'
export const PLAN_STORAGE_KEY = 'wad_plan_v1'

const VALID_TIMEFRAMES: Timeframe[] = ['hourly', 'weekly', 'biweekly', 'monthly', 'yearly']
const DISPLAY_TIMEFRAMES: Timeframe[] = ['weekly', 'biweekly', 'monthly', 'yearly']
const VALID_CATEGORIES = new Set<string>(INCOME_CATEGORIES)
const VALID_CONTRIB_FREQS = new Set<string>(['weekly', 'biweekly', 'monthly'])
const VALID_COMPOUND_FREQS = new Set<string>(['daily', 'monthly', 'annually'])

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isTimeframe(value: unknown): value is Timeframe {
    return typeof value === 'string' && VALID_TIMEFRAMES.includes(value as Timeframe)
}

export function clampDisplayTimeframe(value: unknown): Timeframe {
    if (typeof value === 'string' && DISPLAY_TIMEFRAMES.includes(value as Timeframe)) {
        return value as Timeframe
    }
    return 'monthly'
}

export function isFiniteNonNeg(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function nonNegOrZero(value: unknown): number {
    return isFiniteNonNeg(value) ? value : 0
}

function nonNegIntOrZero(value: unknown): number {
    return isFiniteNonNeg(value) ? Math.floor(value) : 0
}

export function isValidIncomeRow(item: unknown): item is IncomeRow {
    if (!isPlainObject(item)) return false
    return (
        typeof item.id === 'string' &&
        item.id.length > 0 &&
        typeof item.name === 'string' &&
        typeof item.category === 'string' &&
        VALID_CATEGORIES.has(item.category as IncomeCategory) &&
        isFiniteNonNeg(item.amount) &&
        isTimeframe(item.timeframe) &&
        typeof item.hoursPerWeek === 'number' &&
        Number.isFinite(item.hoursPerWeek) &&
        item.hoursPerWeek >= 0
    )
}

export function isValidTaxRow(item: unknown): item is TaxRow {
    if (!isPlainObject(item)) return false
    return (
        typeof item.id === 'string' &&
        item.id.length > 0 &&
        typeof item.name === 'string' &&
        (item.mode === 'dollar' || item.mode === 'percent') &&
        isFiniteNonNeg(item.value)
    )
}

export function isValidExpenseRow(item: unknown): item is ExpenseRow {
    if (!isPlainObject(item)) return false
    return (
        typeof item.id === 'string' &&
        item.id.length > 0 &&
        typeof item.name === 'string' &&
        typeof item.type === 'string' &&
        isFiniteNonNeg(item.amount)
    )
}

/** Most rows a backup can hold per list; far above real use. */
export const MAX_ROWS = 500

/** Fresh row objects with only known fields (drops anything extra a file carried). */
export function rebuildIncomeRow(r: IncomeRow): IncomeRow {
    return {
        id: r.id.slice(0, 100),
        name: r.name.slice(0, 50),
        category: r.category,
        amount: r.amount,
        timeframe: r.timeframe,
        hoursPerWeek: r.hoursPerWeek,
    }
}

export function rebuildTaxRow(r: TaxRow): TaxRow {
    return { id: r.id.slice(0, 100), name: r.name.slice(0, 40), mode: r.mode, value: r.value }
}

export function rebuildExpenseRow(r: ExpenseRow): ExpenseRow {
    return { id: r.id.slice(0, 100), name: r.name.slice(0, 50), type: r.type.slice(0, 30), amount: r.amount }
}

export function defaultIncomeRows(): IncomeRow[] {
    return [
        {
            id: crypto.randomUUID(),
            name: '',
            category: 'Payroll',
            amount: 0,
            timeframe: 'monthly',
            hoursPerWeek: 40,
        },
    ]
}

export function defaultTaxes(): TaxRow[] {
    return DEFAULT_TAXES.map(t => ({ ...t }))
}

export function sanitizePlanState(value: unknown): PlanState {
    if (!isPlainObject(value)) {
        return {
            savingsGoal: { ...DEFAULT_PLAN_STATE.savingsGoal },
            compoundInterest: { ...DEFAULT_PLAN_STATE.compoundInterest },
            investmentReturn: { ...DEFAULT_PLAN_STATE.investmentReturn },
        }
    }

    const sg = isPlainObject(value.savingsGoal) ? value.savingsGoal : {}
    const ci = isPlainObject(value.compoundInterest) ? value.compoundInterest : {}
    const ir = isPlainObject(value.investmentReturn) ? value.investmentReturn : {}

    return {
        savingsGoal: {
            goal: nonNegOrZero(sg.goal),
            contribution: nonNegOrZero(sg.contribution),
            freq:
                typeof sg.freq === 'string' && VALID_CONTRIB_FREQS.has(sg.freq)
                    ? (sg.freq as ContribFreq)
                    : 'monthly',
            rate: nonNegOrZero(sg.rate),
        },
        compoundInterest: {
            principal: nonNegOrZero(ci.principal),
            rate: nonNegOrZero(ci.rate),
            compFreq:
                typeof ci.compFreq === 'string' && VALID_COMPOUND_FREQS.has(ci.compFreq)
                    ? (ci.compFreq as CompoundFreq)
                    : 'monthly',
            years: nonNegIntOrZero(ci.years),
        },
        investmentReturn: {
            initial: nonNegOrZero(ir.initial),
            monthly: nonNegOrZero(ir.monthly),
            rate: nonNegOrZero(ir.rate),
            years: nonNegIntOrZero(ir.years),
        },
    }
}

export function loadBudgetState(): BudgetData {
    const fallback: BudgetData = {
        timeframe: 'monthly',
        incomeRows: defaultIncomeRows(),
        taxes: defaultTaxes(),
        expenses: [],
    }
    try {
        const raw = localStorage.getItem(BUDGET_STORAGE_KEY)
        if (!raw) return fallback
        const parsed: unknown = JSON.parse(raw)
        if (!isPlainObject(parsed)) return fallback

        return {
            timeframe: clampDisplayTimeframe(parsed.timeframe),
            incomeRows: Array.isArray(parsed.incomeRows)
                ? parsed.incomeRows.filter(isValidIncomeRow).slice(0, MAX_ROWS).map(rebuildIncomeRow)
                : fallback.incomeRows,
            taxes: Array.isArray(parsed.taxes)
                ? parsed.taxes.filter(isValidTaxRow).slice(0, MAX_ROWS).map(rebuildTaxRow)
                : fallback.taxes,
            expenses: Array.isArray(parsed.expenses)
                ? parsed.expenses.filter(isValidExpenseRow).slice(0, MAX_ROWS).map(rebuildExpenseRow)
                : fallback.expenses,
        }
    } catch {
        return fallback
    }
}

export function saveBudgetState(data: BudgetData): void {
    try {
        localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(data))
    } catch {
        // ignore quota or privacy-mode errors
    }
}

export function loadPlanState(): PlanState {
    try {
        const raw = localStorage.getItem(PLAN_STORAGE_KEY)
        if (!raw) return sanitizePlanState(null)
        const parsed: unknown = JSON.parse(raw)
        return sanitizePlanState(parsed)
    } catch {
        return sanitizePlanState(null)
    }
}

export function savePlanState(plan: PlanState): void {
    try {
        localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan))
    } catch {
        // ignore quota or privacy-mode errors
    }
}
