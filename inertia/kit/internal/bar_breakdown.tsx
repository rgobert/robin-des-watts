import { motion, useReducedMotion } from 'motion/react'
import { duration, ease } from '../motion'
import { cx } from '../utils'
import { fmtPct, fmtSignedPct } from './chart_utils'

export type BreakdownItem = {
  id: string
  label: string
  value: number
  previous?: number
  hint?: string
}

/**
 * Barres horizontales par segment (offre, région, canal) avec valeur, part du total et variation.
 * Friction traitée : un camembert ou une liste de chiffres ne permet pas de comparer les segments d'un coup d'œil.
 * Une seule teinte (une seule série) ; `highlight` met un segment en avant et grise les autres.
 */
export function BarBreakdown({
  items,
  format,
  highlight,
  sort = true,
  totalLabel = 'Total',
  ariaLabel,
  pending,
  onSelect,
  className,
}: {
  items: BreakdownItem[]
  format: (v: number) => string
  /** id du segment à mettre en avant (forme « emphase »). */
  highlight?: string
  sort?: boolean
  totalLabel?: string
  ariaLabel?: string
  pending?: boolean
  /** Clic sur une ligne (ex. filtrer la liste des comptes). */
  onSelect?: (id: string) => void
  className?: string
}) {
  const reduce = useReducedMotion()
  const rows = sort ? [...items].sort((a, b) => b.value - a.value) : items
  const total = rows.reduce((s, r) => s + r.value, 0)
  const max = Math.max(...rows.map((r) => r.value), 1)
  const auto = `Répartition, ${rows.length} segments, total ${format(total)} : ${rows
    .map((r) => `${r.label} ${format(r.value)} (${fmtPct((r.value / total) * 100, 0)})`)
    .join(', ')}.`

  return (
    <figure
      className={cx('@container min-w-0 transition-opacity', pending && 'opacity-50', className)}
      aria-label={ariaLabel ?? auto}
      role="group"
    >
      <ul className="space-y-1">
        {rows.map((r, i) => {
          const pct = total ? (r.value / total) * 100 : 0
          const delta = r.previous ? ((r.value - r.previous) / r.previous) * 100 : undefined
          const dim = highlight && highlight !== r.id
          const rowClass = cx(
            'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-sm px-2 py-2 text-left @lg:grid-cols-[9rem_minmax(0,1fr)_auto]',
            onSelect &&
              'cursor-pointer hover:bg-surface-2/60 focus-visible:outline-2 focus-visible:outline-primary'
          )
          const content = (
            <>
              <span className="truncate text-sm text-ink">{r.label}</span>
              <span className="col-span-2 row-start-2 h-3 @lg:col-span-1 @lg:row-start-auto">
                <motion.span
                  className="block h-full rounded-r-[4px]"
                  style={{
                    background: dim
                      ? 'color-mix(in oklab, var(--color-ink-muted) 75%, var(--color-surface))' /* 3,5:1 sur surface, 3,2:1 au survol */
                      : 'var(--color-primary)',
                  }}
                  initial={reduce ? false : { width: '0%' }}
                  animate={{ width: `${Math.max(0.5, (r.value / max) * 100)}%` }}
                  transition={{
                    duration: duration.slow,
                    ease: ease.out,
                    delay: reduce ? 0 : i * 0.04,
                  }}
                />
              </span>
              <span className="col-start-2 row-start-1 text-right text-sm whitespace-nowrap tabular-nums @lg:col-start-auto @lg:row-start-auto">
                <span className="font-semibold text-ink">{format(r.value)}</span>
                <span className="ml-2 inline-block text-ink-muted @lg:w-10">{fmtPct(pct, 0)}</span>
                {delta !== undefined && (
                  <span
                    className={cx(
                      'ml-1.5 inline-block text-xs @lg:w-14',
                      delta >= 0 ? 'text-success' : 'text-danger'
                    )}
                  >
                    {fmtSignedPct(delta)}
                  </span>
                )}
              </span>
            </>
          )
          return (
            <li key={r.id}>
              {onSelect ? (
                <button
                  type="button"
                  title={r.hint}
                  onClick={() => onSelect(r.id)}
                  className={rowClass}
                >
                  {content}
                </button>
              ) : (
                <div title={r.hint} className={rowClass}>
                  {content}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <figcaption className="mt-2 flex justify-between border-t border-line px-2 pt-2 text-sm">
        <span className="text-ink-muted">{totalLabel}</span>
        <span className="font-semibold text-ink tabular-nums">{format(total)}</span>
      </figcaption>
    </figure>
  )
}
