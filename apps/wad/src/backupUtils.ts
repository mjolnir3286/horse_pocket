import { importFromCSV, type BudgetData } from './csvUtils'
import {
    clampDisplayTimeframe,
    isPlainObject,
    isTimeframe,
    isValidExpenseRow,
    isValidIncomeRow,
    isValidTaxRow,
    sanitizePlanState,
} from './storage'
import type { PlanState } from './types'

export interface WadBackup extends BudgetData {
    app: 'wad'
    version: 1
    exportedAt: string
    plan?: PlanState
}

export interface ImportedWadData extends BudgetData {
    plan?: PlanState
}

export function buildWadBackup(data: BudgetData, plan?: PlanState): WadBackup {
    return {
        app: 'wad',
        version: 1,
        exportedAt: new Date().toISOString(),
        timeframe: clampDisplayTimeframe(data.timeframe),
        incomeRows: data.incomeRows,
        taxes: data.taxes,
        expenses: data.expenses,
        ...(plan ? { plan } : {}),
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
): { ok: true; data: ImportedWadData } | { ok: false; error: string } {
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
        if (parsed.plan !== undefined && !isPlainObject(parsed.plan)) {
            return { ok: false, error: friendly }
        }
        return {
            ok: true,
            data: {
                timeframe: clampDisplayTimeframe(parsed.timeframe),
                incomeRows: parsed.incomeRows,
                taxes: parsed.taxes,
                expenses: parsed.expenses,
                ...(parsed.plan !== undefined ? { plan: sanitizePlanState(parsed.plan) } : {}),
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
    return {
        ok: true,
        data: {
            ...csvData,
            timeframe: clampDisplayTimeframe(csvData.timeframe),
        },
    }
}
