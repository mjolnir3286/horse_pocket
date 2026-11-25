import { useEffect, useId, useRef, useState } from 'react'

interface HelpModalProps {
    open: boolean
    onClose: () => void
    restoreFocusRef?: React.RefObject<HTMLButtonElement | null>
}

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface HelpItem {
    icon: React.ReactNode
    label: string
    text: string
}

const TABS: HelpItem[] = [
    {
        icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" x2="12" y1="2" y2="22" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
        ),
        label: 'Income',
        text: 'Add paychecks or side income, each with its own schedule (including hourly with hours per week). On wider screens, this sits inside Budget.',
    },
    {
        icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="19" x2="5" y1="5" y2="19" />
                <circle cx="6.5" cy="6.5" r="2.5" />
                <circle cx="17.5" cy="17.5" r="2.5" />
            </svg>
        ),
        label: 'Taxes',
        text: 'Track federal, state, or custom taxes as fixed dollar amounts or percentages of your total income.',
    },
    {
        icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
                <path d="M8 7h8" />
                <path d="M8 11h8" />
                <path d="M8 15h5" />
            </svg>
        ),
        label: 'Expenses',
        text: 'Log bills, subscriptions, and regular costs, or choose Other to type your own category.',
    },
    {
        icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
            </svg>
        ),
        label: 'Plan',
        text: 'Try Savings Goal, Compound Interest, and Investment Return charts without changing your main budget.',
    },
]

const TIPS: HelpItem[] = [
    {
        icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
        ),
        label: 'Display period',
        text: 'Switch Weekly, Bi-Weekly, Monthly, or Yearly with the Per selector to convert taxes, expenses, and totals automatically.',
    },
    {
        icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 3 4 7l4 4" />
                <path d="M4 7h16" />
                <path d="m16 21 4-4-4-4" />
                <path d="M20 17H4" />
            </svg>
        ),
        label: 'Swipe tabs',
        text: 'On a phone, swipe sideways on the bottom tab bar to switch tabs.',
    },
    {
        icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
                <path d="M12 18h.01" />
            </svg>
        ),
        label: 'Saved on device',
        text: 'Your budget and Plan calculators save automatically in this browser. Clearing browser data erases them.',
    },
    {
        icon: (
            <span className="inline-flex items-center" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" x2="12" y1="3" y2="15" />
                </svg>
            </span>
        ),
        label: 'Back up',
        text: 'In the menu under Your Data, Export saves a .json backup and Import restores a .json or .csv file, replacing what is saved now.',
    },
    {
        icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
        ),
        label: 'Install',
        text: 'Use Install in the header or the menu, or your browser’s “Add to Home screen” option.',
    },
]

export default function HelpModal({ open, onClose, restoreFocusRef }: HelpModalProps) {
    if (!open) return null
    return <HelpModalSheet onClose={onClose} restoreFocusRef={restoreFocusRef} />
}

function HelpModalSheet({
    onClose,
    restoreFocusRef,
}: Omit<HelpModalProps, 'open'>) {
    const titleId = useId()
    const descId = useId()
    const tabsId = useId()
    const tipsId = useId()
    const dialogRef = useRef<HTMLDivElement>(null)
    const closeRef = useRef<HTMLButtonElement>(null)
    const [tabsOpen, setTabsOpen] = useState(false)
    const [tipsOpen, setTipsOpen] = useState(false)

    const handleClose = () => {
        onClose()
        window.requestAnimationFrame(() => {
            restoreFocusRef?.current?.focus()
        })
    }

    useEffect(() => {
        const dialog = dialogRef.current
        const frame = window.requestAnimationFrame(() => {
            closeRef.current?.focus()
        })

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
                window.requestAnimationFrame(() => {
                    restoreFocusRef?.current?.focus()
                })
                return
            }
            if (event.key !== 'Tab' || !dialog) return
            const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
                (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
            )
            if (focusable.length === 0) {
                event.preventDefault()
                dialog.focus()
                return
            }
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            const active = document.activeElement
            if (event.shiftKey && (active === first || !dialog.contains(active))) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
                event.preventDefault()
                first.focus()
            }
        }

        document.addEventListener('keydown', onKeyDown)
        return () => {
            window.cancelAnimationFrame(frame)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [onClose, restoreFocusRef])

    return (
        <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4"
            onClick={handleClose}
            role="presentation"
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descId}
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md max-h-[88dvh] flex flex-col overflow-hidden bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-t-2xl sm:rounded-2xl p-5 shadow-xl text-gray-900 dark:text-neutral-100"
            >
                <div className="flex items-start justify-between gap-3 mb-3 shrink-0">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                            Help
                        </p>
                        <h2 id={titleId} className="text-lg font-bold tracking-tight">
                            Wad
                        </h2>
                    </div>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={handleClose}
                        aria-label="Close help"
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>
                </div>

                <p id={descId} className="text-sm text-gray-600 dark:text-neutral-300 mb-3.5 shrink-0">
                    Wad helps you track take-home pay, taxes, expenses, and savings plans. Everything is saved on this device only.
                </p>

                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 mb-4 pr-0.5">
                    <section className="border border-gray-200 dark:border-neutral-700 rounded-xl bg-gray-50/70 dark:bg-neutral-800/40">
                        <button
                            type="button"
                            aria-expanded={tabsOpen}
                            aria-controls={tabsId}
                            onClick={() => setTabsOpen((prev) => !prev)}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-left cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                            <span>Tabs</span>
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                                className={`wad-help-chevron shrink-0${tabsOpen ? ' is-open' : ''}`}
                            >
                                <path d="m6 9 6 6 6-6" />
                            </svg>
                        </button>
                        <div id={tabsId} role="region" hidden={!tabsOpen} className="px-3 pb-3">
                            <ul className="space-y-2.5">
                                {TABS.map((item) => (
                                    <li key={item.label} className="flex items-start gap-2.5">
                                        <span
                                            aria-hidden="true"
                                            className="w-8 h-8 rounded-lg bg-accent/15 text-accent grid place-items-center shrink-0"
                                        >
                                            {item.icon}
                                        </span>
                                        <div className="min-w-0">
                                            <strong className="block text-sm font-semibold text-gray-900 dark:text-neutral-100">
                                                {item.label}
                                            </strong>
                                            <p className="mt-0.5 text-xs text-gray-600 dark:text-neutral-300 leading-snug">
                                                {item.text}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </section>

                    <section className="border border-gray-200 dark:border-neutral-700 rounded-xl bg-gray-50/70 dark:bg-neutral-800/40">
                        <button
                            type="button"
                            aria-expanded={tipsOpen}
                            aria-controls={tipsId}
                            onClick={() => setTipsOpen((prev) => !prev)}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-left cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                            <span>Tips</span>
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                                className={`wad-help-chevron shrink-0${tipsOpen ? ' is-open' : ''}`}
                            >
                                <path d="m6 9 6 6 6-6" />
                            </svg>
                        </button>
                        <div id={tipsId} role="region" hidden={!tipsOpen} className="px-3 pb-3">
                            <ul className="space-y-2.5">
                                {TIPS.map((item) => (
                                    <li key={item.label} className="flex items-start gap-2.5">
                                        <span
                                            aria-hidden="true"
                                            className="w-8 h-8 rounded-lg bg-accent/15 text-accent grid place-items-center shrink-0"
                                        >
                                            {item.icon}
                                        </span>
                                        <div className="min-w-0">
                                            <strong className="block text-sm font-semibold text-gray-900 dark:text-neutral-100">
                                                {item.label}
                                            </strong>
                                            <p className="mt-0.5 text-xs text-gray-600 dark:text-neutral-300 leading-snug">
                                                {item.text}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </section>
                </div>

                <div className="flex justify-end shrink-0 pt-1">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
