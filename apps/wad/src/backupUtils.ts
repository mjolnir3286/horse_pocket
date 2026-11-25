import { importFromCSV, type BudgetData } from './csvUtils'
import {
    INCOME_CATEGORIES,
    type ExpenseRow,
    type IncomeCategory,
    type IncomeRow,
    type TaxRow,
    type Timeframe,
} from './types'

export interface WadBackup extends BudgetData {
    app: 'wad'
    version: 1
    exportedAt: string
}

const VALID_TIMEFRAMES: Timeframe[] = ['hourly', 'weekly', 'biweekly', 'monthly', 'yearly']
const VALID_CATEGORIES = new Set<string>(INCOME_CATEGORIES)

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTimeframe(value: unknown): value is Timeframe {
    return typeof value === 'string' && VALID_TIMEFRAMES.includes(value as Timeframe)
}

function isFiniteNonNeg(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isValidIncomeRow(item: unknown): item is IncomeRow {
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

function isValidTaxRow(item: unknown): item is TaxRow {
    if (!isPlainObject(item)) return false
    return (
        typeof item.id === 'string' &&
        item.id.length > 0 &&
        typeof item.name === 'string' &&
        (item.mode === 'dollar' || item.mode === 'percent') &&
        isFiniteNonNeg(item.value)
    )
}

function isValidExpenseRow(item: unknown): item is ExpenseRow {
    if (!isPlainObject(item)) return false
    return (
        typeof item.id === 'string' &&
        item.id.length > 0 &&
        typeof item.name === 'string' &&
        typeof item.type === 'string' &&
        isFiniteNonNeg(item.amount)
    )
}

export function buildWadBackup(data: BudgetData): WadBackup {
    return {
        app: 'wad',
        version: 1,
        exportedAt: new Date().toISOString(),
        timeframe: data.timeframe,
        incomeRows: data.incomeRows,
        taxes: data.taxes,
        expenses: data.expenses,
    }
}

export function wadBackupFilename(): string {
    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    const time = now.toTimeString().slice(0, 5).replace(':', '')
    return `wad-backup-${date}-${time}.json`
}

export function downloadWadBackup(backup: WadBackup) {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = wadBackupFilename()
    a.click()
    URL.revokeObjectURL(url)
}

export function parseWadImport(
    rawText: string
): { ok: true; data: BudgetData } | { ok: false; error: string } {
    const friendly = 'Could not import file. Make sure it is a valid Wad backup (.json or .csv).'
    const trimmed = rawText.trim()
    if (!trimmed) {
        return { ok: false, error: friendly }
    }

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        let parsed: unknown
        try {
            parsed = JSON.parse(trimmed)
        } catch {
            return { ok: false, error: friendly }
        }
        if (
            !isPlainObject(parsed) ||
            parsed.app !== 'wad' ||
            parsed.version !== 1 ||
            !isTimeframe(parsed.timeframe) ||
            !Array.isArray(parsed.incomeRows) ||
            !parsed.incomeRows.every(isValidIncomeRow) ||
            !Array.isArray(parsed.taxes) ||
            !parsed.taxes.every(isValidTaxRow) ||
            !Array.isArray(parsed.expenses) ||
            !parsed.expenses.every(isValidExpenseRow)
        ) {
            return { ok: false, error: friendly }
        }
        return {
            ok: true,
            data: {
                timeframe: parsed.timeframe,
                incomeRows: parsed.incomeRows,
                taxes: parsed.taxes,
                expenses: parsed.expenses,
            },
        }
    }

    // Legacy CSV support: require recognizable Wad CSV header or row prefix
    const lines = trimmed
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
    const looksLikeWadCsv =
        lines.length > 0 &&
        (lines[0].startsWith('rowType,') ||
            lines.some((l) => /^(meta|income|tax|expense),/.test(l)))
    if (!looksLikeWadCsv) {
        return { ok: false, error: friendly }
    }

    const csvData = importFromCSV(rawText)
    if (!csvData) {
        return { ok: false, error: friendly }
    }
    return { ok: true, data: csvData }
}
