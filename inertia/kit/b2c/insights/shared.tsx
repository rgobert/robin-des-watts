/*
 * Utilitaires internes aux composants « insights » (non exportés par index.ts pour éviter les collisions).
 */
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { duration, ease, spring } from '../../motion'
import { cx } from '../../utils'

/* ---------- Formats FR ---------- */

const nf = (d: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })
export const fmtNum = (v: number, d = 0) => nf(d).format(v)
export const fmtKwh = (v: number, d = 0) => `${fmtNum(v, d)} kWh`
export const fmtKw = (v: number, d = 1) => `${fmtNum(v, d)} kW`
export const fmtPct = (v: number, d = 0) => `${fmtNum(v, d)} %`

/* ---------- Dates (ISO AAAA-MM-JJ, calculées en UTC pour éviter les décalages de fuseau) ---------- */

export const parseIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
export const DAY_MS = 86_400_000
export const addDays = (iso: string, days: number) =>
  new Date(parseIso(iso) + Math.round(days) * DAY_MS).toISOString().slice(0, 10)
export const daysBetween = (a: string, b: string) =>
  Math.round((parseIso(b) - parseIso(a)) / DAY_MS)
export const fmtDate = (
  iso: string,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
) => new Intl.DateTimeFormat('fr-FR', { ...opts, timeZone: 'UTC' }).format(new Date(parseIso(iso)))

/* ---------- Mesure de largeur (graphiques en pixels réels : texte lisible à toutes les tailles) ---------- */

export function useElementWidth<T extends HTMLElement>(
  fallback = 600
): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    setWidth(node.clientWidth || fallback)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(Math.round(w))
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [fallback])
  return [ref, width]
}

/* ---------- Infobulle de graphique : valeur en premier, libellé ensuite ---------- */

export function ChartTooltip({
  x,
  y,
  width,
  children,
  show,
}: {
  x: number
  y: number
  width: number
  children: ReactNode
  show: boolean
}) {
  const tipW = Math.min(220, width - 8)
  const left = Math.max(4, Math.min(width - tipW - 4, x - tipW / 2))
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="status"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: duration.instant } }}
          transition={{ duration: duration.fast, ease: ease.out }}
          className="pointer-events-none absolute z-20 rounded-sm border border-line bg-surface px-3 py-2 text-xs leading-snug text-ink shadow-card"
          style={{ left, top: Math.max(0, y), width: tipW }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Ligne d'infobulle : petit trait de la couleur de série, valeur forte, libellé discret. */
export function TipRow({ color, value, label }: { color?: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {color && <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: color }} />}
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-ink-muted">{label}</span>
    </div>
  )
}

/* ---------- Navigation clavier dans un graphique (flèches, Début, Fin, Échap) ---------- */

export function useArrowIndex(count: number) {
  const [index, setIndex] = useState<number | null>(null)
  const onKeyDown = (e: KeyboardEvent) => {
    const cur = index ?? -1
    let next: number | null = cur
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(count - 1, cur + 1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      next = Math.max(0, cur < 0 ? count - 1 : cur - 1)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = count - 1
    else if (e.key === 'Escape') next = null
    else return
    e.preventDefault()
    setIndex(next)
  }
  return { index, setIndex, onKeyDown, onBlur: () => setIndex(null) }
}

/* ---------- Sélecteur segmenté (radiogroup, pastille qui glisse) ---------- */

export function Segmented<K extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: K
  onChange: (k: K) => void
  options: { key: K; label: string }[]
  label: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const pillId = useId()
  const onKey = (e: KeyboardEvent, i: number) => {
    const dir =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0
    if (!dir) return
    e.preventDefault()
    const n = (i + dir + options.length) % options.length
    refs.current[n]?.focus()
    onChange(options[n].key)
  }
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(
        'inline-flex max-w-full gap-0.5 rounded-full border border-line bg-surface p-0.5',
        className
      )}
    >
      {options.map((o, i) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            ref={(n) => {
              refs.current[i] = n
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.key)}
            onKeyDown={(e) => onKey(e, i)}
            className={cx(
              'relative shrink-0 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
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
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ---------- Vue tableau repliable (accessibilité : toutes les valeurs sans survol) ---------- */

export function DataTable({
  caption,
  head,
  rows,
  summary = 'Voir les données en tableau',
}: {
  caption: string
  head: string[]
  rows: (string | number)[][]
  summary?: string
}) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer font-medium text-primary focus-visible:outline-2 focus-visible:outline-primary">
        {summary}
      </summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-sm border border-line">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-2 text-ink/75">
            <tr>
              {head.map((h) => (
                <th key={h} scope="col" className="px-3 py-1.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-surface">
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className={cx('px-3 py-1.5', j > 0 && 'tabular-nums')}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
