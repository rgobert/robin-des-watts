import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { duration, ease } from '../motion'
import { cx } from '../utils'
import { fmtEuroCompact, fmtInt, fmtPct } from './chart_utils'

export type ChurnReason = {
  id: string
  label: string
  count: number
  mrrLost: number
  verbatim?: string
}

/**
 * Raisons de résiliation issues du sondage de départ, triées par revenu perdu (et non par nombre de réponses),
 * avec un verbatim dépliable par raison.
 * Friction traitée : « le churn est à 1,4 % » ne dit pas quoi corriger ; une raison peu fréquente mais
 * portée par des clients à fort MRR (ex. coffret Robin chez ENCORE) passe inaperçue dans un simple décompte.
 * Pattern : P20 (Baremetrics Cancellation Insights : sondage à la résiliation et revenu perdu par raison).
 */
export function ChurnReasons({
  reasons,
  responseRate,
  sortBy = 'revenue',
  pending,
  onReasonClick,
  actionLabel = 'Voir les comptes',
  className,
}: {
  reasons: ChurnReason[]
  /** Part des partants ayant répondu au sondage (0-100). */
  responseRate?: number
  sortBy?: 'revenue' | 'count'
  pending?: boolean
  onReasonClick?: (id: string) => void
  actionLabel?: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState<string | null>(null)
  const [sort, setSort] = useState(sortBy)
  const rows = [...reasons].sort((a, b) =>
    sort === 'revenue' ? b.mrrLost - a.mrrLost : b.count - a.count
  )
  const total = reasons.reduce((s, r) => s + r.mrrLost, 0)
  const totalCount = reasons.reduce((s, r) => s + r.count, 0)
  const max = Math.max(...rows.map((r) => (sort === 'revenue' ? r.mrrLost : r.count)), 1)
  const top = rows[0]
  const aria = `Raisons de résiliation, ${fmtInt(totalCount)} départs, ${fmtEuroCompact(total)} de MRR perdu. Première raison : ${top?.label} (${fmtEuroCompact(top?.mrrLost ?? 0)}).`

  return (
    <figure
      role="group"
      aria-label={aria}
      className={cx('min-w-0 transition-opacity', pending && 'opacity-50', className)}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <span>
          {fmtInt(totalCount)} départs ·{' '}
          <span className="font-semibold text-ink tabular-nums">{fmtEuroCompact(total)}</span> de
          MRR perdu
          {responseRate !== undefined && <> · {fmtPct(responseRate, 0)} de réponses</>}
        </span>
        <div
          className="flex gap-0.5 rounded-full bg-surface-2 p-0.5"
          role="group"
          aria-label="Trier par"
        >
          {(['revenue', 'count'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={sort === k}
              onClick={() => setSort(k)}
              className={cx(
                'rounded-full px-2.5 py-1 font-medium focus-visible:outline-2 focus-visible:outline-primary',
                sort === k ? 'bg-surface text-ink shadow-card' : 'text-ink hover:bg-surface'
              )}
            >
              {k === 'revenue' ? '€ perdus' : 'Nombre'}
            </button>
          ))}
        </div>
      </div>
      <ul className="space-y-0.5">
        {rows.map((r, i) => {
          const v = sort === 'revenue' ? r.mrrLost : r.count
          const isOpen = open === r.id
          return (
            <li key={r.id}>
              <button
                type="button"
                aria-expanded={r.verbatim ? isOpen : undefined}
                onClick={() => setOpen(isOpen ? null : r.id)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-sm px-2 py-1.5 text-left hover:bg-surface-2/60 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="truncate text-sm text-ink">{r.label}</span>
                <span className="text-right text-sm whitespace-nowrap tabular-nums">
                  <span className="font-semibold text-ink">{fmtEuroCompact(r.mrrLost)}</span>
                  <span className="ml-2 text-xs text-ink-muted">{fmtInt(r.count)} dép.</span>
                </span>
                <span className="col-span-2 h-2">
                  <motion.span
                    className="block h-full rounded-r-[4px]"
                    style={{
                      background:
                        i === 0
                          ? 'var(--color-primary)'
                          : 'color-mix(in oklab, var(--color-ink-muted) 75%, var(--color-surface))' /* 3,5:1 sur surface, 3,2:1 au survol */,
                    }}
                    initial={reduce ? false : { width: '0%' }}
                    animate={{ width: `${Math.max(0.5, (v / max) * 100)}%` }}
                    transition={{
                      duration: duration.slow,
                      ease: ease.out,
                      delay: reduce ? 0 : i * 0.04,
                    }}
                  />
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: duration.base, ease: ease.out }}
                    className="overflow-hidden"
                  >
                    <div className="mx-2 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-sm bg-surface-2/50 px-3 py-2 text-sm">
                      <p className="text-ink-muted italic">
                        {r.verbatim ?? 'Pas de verbatim pour cette raison.'}
                      </p>
                      {onReasonClick && (
                        <button
                          type="button"
                          onClick={() => onReasonClick(r.id)}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          {actionLabel}
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>
    </figure>
  )
}
