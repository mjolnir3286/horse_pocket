import { useEffect, useId, useRef, useState } from 'react'

export interface PendingWadImport {
    summary: string
    apply: () => void
}

interface SideMenuProps {
    id: string
    open: boolean
    onClose: () => void
    restoreFocusRef: React.RefObject<HTMLButtonElement | null>
    onOpenHelp: () => void
    onOpenAbout: () => void
    onExport: () => void
    onValidateImport: (
        rawText: string
    ) => { ok: true; pending: PendingWadImport } | { ok: false; error: string }
}

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea, input:not([disabled]):not([type="file"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function SideMenu({
    id,
    open,
    onClose,
    restoreFocusRef,
    onOpenHelp,
    onOpenAbout,
    onExport,
    onValidateImport,
}: SideMenuProps) {
    const titleId = useId()
    const dataHeadingId = useId()
    const panelRef = useRef<HTMLDivElement>(null)
    const closeButtonRef = useRef<HTMLButtonElement>(null)
    const importButtonRef = useRef<HTMLButtonElement>(null)
    const confirmButtonRef = useRef<HTMLButtonElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [pendingImport, setPendingImport] = useState<PendingWadImport | null>(null)
    const [dataError, setDataError] = useState<string | null>(null)
    const [dataStatus, setDataStatus] = useState<string | null>(null)

    useEffect(() => {
        if (!open) {
            setPendingImport(null)
            setDataError(null)
            setDataStatus(null)
        }
    }, [open])

    const handleCloseWithRestore = () => {
        onClose()
        window.requestAnimationFrame(() => {
            restoreFocusRef.current?.focus()
        })
    }

    useEffect(() => {
        if (!open) return

        const panel = panelRef.current
        const frame = window.requestAnimationFrame(() => {
            closeButtonRef.current?.focus()
        })

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
                window.requestAnimationFrame(() => {
                    restoreFocusRef.current?.focus()
                })
                return
            }
            if (event.key !== 'Tab' || !panel) return

            const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
                (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
            )
            if (focusable.length === 0) {
                event.preventDefault()
                panel.focus()
                return
            }
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            const active = document.activeElement
            if (event.shiftKey && (active === first || !panel.contains(active))) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
                event.preventDefault()
                first.focus()
            }
        }

        document.addEventListener('keydown', onKeyDown)
        return () => {
            window.cancelAnimationFrame(frame)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [open, onClose, restoreFocusRef])

    useEffect(() => {
        if (pendingImport) {
            window.requestAnimationFrame(() => {
                confirmButtonRef.current?.focus()
            })
        }
    }, [pendingImport])

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return

        setDataError(null)
        setDataStatus(null)

        try {
            const text = await file.text()
            const res = onValidateImport(text)
            if (!res.ok) {
                setPendingImport(null)
                setDataError(res.error)
                return
            }
            setPendingImport(res.pending)
        } catch {
            setPendingImport(null)
            setDataError('Could not read that file. Make sure it is a valid Wad backup (.json or .csv).')
        }
    }

    const handleConfirmImport = () => {
        if (!pendingImport) return
        pendingImport.apply()
        setPendingImport(null)
        setDataError(null)
        setDataStatus('Imported backup. Your lists have been replaced.')
        window.requestAnimationFrame(() => {
            importButtonRef.current?.focus()
        })
    }

    const handleCancelImport = () => {
        setPendingImport(null)
        window.requestAnimationFrame(() => {
            importButtonRef.current?.focus()
        })
    }

    const handleExportClick = () => {
        setDataError(null)
        setPendingImport(null)
        onExport()
        setDataStatus('Backup downloaded.')
    }

    if (!open) return null

    return (
        <div
            className="wad-drawer-backdrop fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-start"
            onClick={handleCloseWithRestore}
            role="presentation"
        >
            <div
                id={id}
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                className="wad-drawer-panel w-[min(320px,86vw)] h-full bg-white dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-700 shadow-2xl flex flex-col overflow-y-auto text-gray-900 dark:text-neutral-100 focus:outline-none"
            >
                <div className="flex items-center justify-between gap-2 px-4 py-3.5 border-b border-gray-200 dark:border-neutral-800">
                    <div className="flex items-center gap-2 min-w-0">
                        <img
                            src={`${import.meta.env.BASE_URL}wad-icon.png`}
                            alt=""
                            className="w-8 h-8 block shrink-0"
                            width={32}
                            height={32}
                        />
                        <h2 id={titleId} className="text-base font-bold tracking-tight">
                            Wad
                        </h2>
                    </div>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        aria-label="Close menu"
                        onClick={handleCloseWithRestore}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-3.5 flex flex-col gap-5">
                    <div className="flex flex-col gap-1">
                        <a
                            href="https://mjolnir3286.github.io/horse_pocket/"
                            aria-label="Back to Horse Pocket"
                            className="min-h-10.5 px-3 py-2 rounded-lg flex items-center gap-2.5 text-sm font-semibold text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="m15 18-6-6 6-6" />
                            </svg>
                            <span>Horse Pocket</span>
                        </a>

                        <button
                            type="button"
                            onClick={() => {
                                onClose()
                                onOpenHelp()
                            }}
                            className="w-full min-h-10.5 px-3 py-2 rounded-lg flex items-center gap-2.5 text-sm font-semibold text-left hover:bg-gray-100 dark:hover:bg-neutral-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                                <path d="M12 17h.01" />
                            </svg>
                            <span>Help</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                onClose()
                                onOpenAbout()
                            }}
                            className="w-full min-h-10.5 px-3 py-2 rounded-lg flex items-center gap-2.5 text-sm font-semibold text-left hover:bg-gray-100 dark:hover:bg-neutral-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 16v-4" />
                                <path d="M12 8h.01" />
                            </svg>
                            <span>About</span>
                        </button>
                    </div>

                    <section
                        aria-labelledby={dataHeadingId}
                        className="border-t border-gray-200 dark:border-neutral-800 pt-4 flex flex-col gap-2.5"
                    >
                        <h3
                            id={dataHeadingId}
                            className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400"
                        >
                            Your Data
                        </h3>
                        <p className="text-xs leading-relaxed text-gray-600 dark:text-neutral-400">
                            Your lists are saved on this device only. Clearing browser data erases them.
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={handleExportClick}
                                className="min-h-9.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/70 text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:border-gray-300 dark:hover:border-neutral-600 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" x2="12" y1="15" y2="3" />
                                </svg>
                                <span>Export</span>
                            </button>

                            <button
                                ref={importButtonRef}
                                type="button"
                                onClick={() => {
                                    setDataError(null)
                                    setDataStatus(null)
                                    fileInputRef.current?.click()
                                }}
                                className="min-h-9.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/70 text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:border-gray-300 dark:hover:border-neutral-600 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" x2="12" y1="3" y2="15" />
                                </svg>
                                <span>Import</span>
                            </button>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json,.csv,application/json,text/csv"
                                className="sr-only"
                                aria-label="Choose a Wad backup file"
                                onChange={handleFileChange}
                            />
                        </div>

                        {pendingImport && (
                            <div
                                role="region"
                                aria-label="Confirm import"
                                className="p-3 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 flex flex-col gap-2.5"
                            >
                                <p className="text-xs leading-snug text-gray-800 dark:text-neutral-200">
                                    This will replace your current lists ({pendingImport.summary}).
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        ref={confirmButtonRef}
                                        type="button"
                                        onClick={handleConfirmImport}
                                        className="flex-1 min-h-8.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold cursor-pointer hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                    >
                                        Replace lists
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCancelImport}
                                        className="flex-1 min-h-8.5 px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-neutral-600 text-xs font-semibold cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {dataError && (
                            <p
                                role="alert"
                                className="px-2.5 py-2 rounded-lg bg-red-500/10 text-red-700 dark:text-red-300 text-xs leading-snug"
                            >
                                {dataError}
                            </p>
                        )}

                        {dataStatus && !dataError && (
                            <p
                                role="status"
                                className="px-2.5 py-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs leading-snug"
                            >
                                {dataStatus}
                            </p>
                        )}
                    </section>
                </div>
            </div>
        </div>
    )
}
