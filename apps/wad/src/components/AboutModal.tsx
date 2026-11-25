import { useEffect, useId, useRef } from 'react'

interface AboutModalProps {
    open: boolean
    onClose: () => void
    restoreFocusRef?: React.RefObject<HTMLButtonElement | null>
}

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function AboutModal({ open, onClose, restoreFocusRef }: AboutModalProps) {
    const titleId = useId()
    const descId = useId()
    const dialogRef = useRef<HTMLDivElement>(null)
    const closeRef = useRef<HTMLButtonElement>(null)

    const handleClose = () => {
        onClose()
        window.requestAnimationFrame(() => {
            restoreFocusRef?.current?.focus()
        })
    }

    useEffect(() => {
        if (!open) return
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
    }, [open, onClose, restoreFocusRef])

    if (!open) return null

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
                className="w-full max-w-md max-h-[88dvh] overflow-y-auto bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-t-2xl sm:rounded-2xl p-5 shadow-xl text-gray-900 dark:text-neutral-100"
            >
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                            About •{' '}
                            <a
                                href="../"
                                className="underline underline-offset-2 hover:text-gray-800 dark:hover:text-neutral-200"
                            >
                                Horse Pocket
                            </a>
                        </p>
                        <h2 id={titleId} className="text-lg font-bold tracking-tight">
                            Wad
                        </h2>
                    </div>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={handleClose}
                        aria-label="Close about"
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>
                </div>

                <div id={descId} className="text-sm text-gray-600 dark:text-neutral-300">
                    <p className="mb-3">
                        A simple take-home budget and paycheck calculator that runs entirely in your browser.
                    </p>
                    <p className="text-gray-900 dark:text-neutral-100 mb-1">
                        Made by{' '}
                        <a
                            href="https://github.com/mjolnir3286"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline underline-offset-2"
                        >
                            Kale G.
                        </a>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mb-3.5">
                        Built with Grok Bot
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-neutral-400">
                        Everything stays on your device — nothing is sent to a server.
                    </p>
                </div>

                <div className="mt-5 flex justify-end">
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
