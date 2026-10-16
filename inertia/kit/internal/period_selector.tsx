import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { duration, ease, spring } from '../motion'
import { cx } from '../utils'
import { fmtDateShort } from './chart_utils'

export type PeriodOption<K extends string = string> = { key: K; label: string; ariaLabel?: string }
export type PeriodRange = { from: string; to: string }

const DEFAULT_OPTIONS: PeriodOption[] = [
  { key: '7d', label: '7 j', ariaLabel: '7 derniers jours' },
  { key: '30d', label: '30 j', ariaLabel: '30 derniers jours' },
  { key: '90d', label: '90 j', ariaLabel: '90 derniers jours' },
  { key: '12m', label: '12 mois', ariaLabel: '12 derniers mois' },
  { key: 'custom', label: 'Personnalisé', ariaLabel: 'Période personnalisée' },
]

/**
 * Sélecteur de période segmenté (7 j / 30 j / 90 j / 12 mois / personnalisé), pastille qui glisse.
 * Friction traitée : changer de fenêtre d'analyse doit coûter un clic, et la période active doit se lire sans chercher.
 * Clavier : flèches gauche/droite (radiogroup). « Personnalisé » ouvre deux dates + « Appliquer ».
 */
export function PeriodSelector<K extends string = string>({
  value,
  onChange,
  options = DEFAULT_OPTIONS as PeriodOption<K>[],
  customKey = 'custom' as K,
  customRange,
  onCustomRange,
  minDate,
  maxDate,
  label = 'Période',
  className,
}: {
  value: K
  onChange: (key: K) => void
  options?: PeriodOption<K>[]
  /** Clé de l'option qui ouvre la saisie de dates. */
  customKey?: K
  customRange?: PeriodRange
  onCustomRange?: (range: PeriodRange) => void
  minDate?: string
  maxDate?: string
  label?: string
  className?: string
}) {
  const pillId = useId()
  const reduce = useReducedMotion()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<PeriodRange>(
    customRange ?? { from: minDate ?? '', to: maxDate ?? '' }
  )
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const customIndex = options.findIndex((o) => o.key === customKey)
  /** Ferme la saisie de dates et rend le focus au bouton « Personnalisé » (sinon il retombe sur <body>). */
  const close = () => {
    setOpen(false)
    refs.current[customIndex]?.focus()
  }

  const select = (k: K) => {
    if (k === customKey) {
      setDraft(customRange ?? draft)
      setOpen(true)
      return
    }
    setOpen(false)
    onChange(k)
  }

  const onKey = (e: KeyboardEvent, i: number) => {
    const dir =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0
    if (!dir) return
    e.preventDefault()
    const next = (i + dir + options.length) % options.length
    refs.current[next]?.focus()
    if (options[next].key !== customKey) select(options[next].key)
  }

  const valid = draft.from && draft.to && draft.from <= draft.to
  const apply = () => {
    if (!valid) return
    onCustomRange?.(draft)
    onChange(customKey)
    close()
  }

  return (
    <div className={cx('relative inline-flex max-w-full', className)} ref={popRef}>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex max-w-full gap-0.5 overflow-x-auto rounded-full border border-line bg-surface p-0.5"
      >
        {options.map((o, i) => {
          const active = o.key === value
          const text =
            o.key === customKey && active && customRange
              ? `${fmtDateShort(customRange.from)} → ${fmtDateShort(customRange.to)}`
              : o.label
          return (
            <button
              key={o.key}
              ref={(n) => {
                refs.current[i] = n
              }}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={o.ariaLabel && !(o.key === customKey && active) ? o.ariaLabel : undefined}
              tabIndex={active ? 0 : -1}
              onClick={() => select(o.key)}
              onKeyDown={(e) => onKey(e, i)}
              className={cx(
                'relative shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
                active ? 'text-primary-contrast' : 'text-ink-muted hover:text-ink'
              )}
            >
              {active && (
                <motion.span
                  layoutId={pillId}
                  className="absolute inset-0 rounded-full bg-primary"
                  transition={reduce ? { duration: 0 } : spring}
                />
              )}
              <span className="relative">{text}</span>
            </button>
          )
        })}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Choisir une période personnalisée"
            initial={{ opacity: 0, y: reduce ? 0 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: duration.instant } }}
            transition={{ duration: duration.fast, ease: ease.out }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                close()
              }
            }}
            className="absolute top-full right-0 z-40 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-md border border-line bg-surface p-4 shadow-card"
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-ink-muted">
                Du
                <input
                  type="date"
                  autoFocus
                  value={draft.from}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                  className="mt-1 block w-full rounded-sm border border-line bg-surface px-2 py-1.5 text-sm text-ink"
                />
              </label>
              <label className="text-xs text-ink-muted">
                Au
                <input
                  type="date"
                  value={draft.to}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                  className="mt-1 block w-full rounded-sm border border-line bg-surface px-2 py-1.5 text-sm text-ink"
                />
              </label>
            </div>
            {!valid && (
              <p className="mt-2 text-xs text-danger">
                La date de début doit précéder la date de fin.
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
              <button
                type="button"
                onClick={close}
                className="rounded-full px-3 py-1.5 text-sm text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!valid}
                onClick={apply}
                className="rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-contrast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40"
              >
                Appliquer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
