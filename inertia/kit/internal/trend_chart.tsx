import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { duration, ease } from '../motion'
import { cx } from '../utils'
import {
  clamp,
  daysBetweenIso,
  fmtDateLong,
  fmtDateShort,
  fmtMonth,
  fmtSignedPct,
  niceTicks,
  scaleLinear,
  useElementWidth,
} from './chart_utils'

export type TrendPoint = { date: string; value: number }
export type TrendAnnotation = { date: string; label: string; detail?: string }

/**
 * Courbe temporelle : crosshair + info-bulle au survol (et au clavier), période précédente en pointillé,
 * annotations d'événements, vue tableau.
 * Friction traitée : « c'est bien ou pas ? » ; sans comparaison ni contexte (S21, campagne, incident),
 * une courbe ne raconte rien et chacun y projette sa propre explication.
 */
export function TrendChart({
  series,
  previous,
  annotations = [],
  label,
  previousLabel = 'Période précédente',
  format,
  axisFormat = format,
  baseline = 'zero',
  height = 240,
  pending,
  ariaLabel,
  tableLabel = 'Voir les données en tableau',
  className,
}: {
  series: TrendPoint[]
  /** Valeurs de la période précédente, alignées par index sur `series`. */
  previous?: number[]
  annotations?: TrendAnnotation[]
  /** Nom de la série (ex. « MRR »). */
  label: string
  previousLabel?: string
  format: (v: number) => string
  axisFormat?: (v: number) => string
  /** `zero` = axe depuis 0 avec aire ; `auto` = axe resserré, ligne seule (pour un stock qui varie peu). */
  baseline?: 'zero' | 'auto'
  height?: number
  /** Rechargement en cours : on garde le rendu précédent, atténué (pas de skeleton qui clignote). */
  pending?: boolean
  ariaLabel?: string
  tableLabel?: string
  className?: string
}) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>()
  const reduce = useReducedMotion()
  const [hover, setHover] = useState<number | null>(null)

  const m = { top: 30, right: 12, bottom: 26, left: 0 }
  const n = series.length
  const all = [...series.map((p) => p.value), ...(previous ?? [])]
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const ticks =
    baseline === 'zero'
      ? niceTicks(0, hi * 1.05, 4)
      : niceTicks(lo - (hi - lo) * 0.15, hi + (hi - lo) * 0.1, 4)
  const tickLabels = ticks.map(axisFormat)
  m.left = Math.max(...tickLabels.map((t) => t.length)) * 6.4 + 10
  const innerW = Math.max(10, width - m.left - m.right)
  const innerH = height - m.top - m.bottom
  const x = scaleLinear(0, Math.max(1, n - 1), m.left, m.left + innerW)
  const y = scaleLinear(ticks[0], ticks[ticks.length - 1]!, m.top + innerH, m.top)

  const line = (vals: number[]) =>
    vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const d = line(series.map((p) => p.value))
  const area = `${d}L${x(n - 1).toFixed(1)},${y(ticks[0])}L${x(0).toFixed(1)},${y(ticks[0])}Z`
  const prevD = previous && previous.length > 1 ? line(previous.slice(0, n)) : null

  const spanDays = n > 1 ? daysBetweenIso(series[0].date, series[n - 1].date) : 0
  const xFmt = spanDays > 120 ? fmtMonth : fmtDateShort
  const xTicks = useMemo(() => {
    const count = Math.max(2, Math.min(6, Math.floor(innerW / 90)))
    return Array.from({ length: count }, (_, i) => Math.round((i * (n - 1)) / (count - 1)))
  }, [innerW, n])

  const notes = annotations
    .map((a) => ({ ...a, i: series.findIndex((p) => p.date >= a.date) }))
    .filter((a) => a.i >= 0)
    .map((a, k, arr) => ({ ...a, row: k > 0 && Math.abs(x(a.i) - x(arr[k - 1].i)) < 110 ? 1 : 0 }))

  const pick = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    setHover(clamp(Math.round((px / rect.width) * (n - 1)), 0, n - 1))
  }
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 7 : 1
    const cur = hover ?? n - 1
    let next: number | null = null
    if (e.key === 'ArrowRight') next = cur + step
    else if (e.key === 'ArrowLeft') next = cur - step
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    else if (e.key === 'Escape') return setHover(null)
    if (next === null) return
    e.preventDefault()
    setHover(clamp(next, 0, n - 1))
  }

  const first = series[0]?.value ?? 0
  const last = series[n - 1]?.value ?? 0
  const change = first ? ((last - first) / first) * 100 : 0
  const prevTotal = previous?.length ? previous[Math.min(previous.length, n) - 1] : undefined
  const autoAria =
    n > 0
      ? `${label}, du ${fmtDateLong(series[0].date)} au ${fmtDateLong(series[n - 1].date)} : de ${format(first)} à ${format(last)} (${fmtSignedPct(change)}).` +
        (prevTotal !== undefined ? ` Fin de la période précédente : ${format(prevTotal)}.` : '') +
        (notes.length ? ` Événements : ${notes.map((a) => a.label).join(', ')}.` : '') +
        ' Flèches gauche et droite pour parcourir les valeurs.'
      : `${label} : aucune donnée.`

  const h = hover !== null ? series[hover] : null
  const hPrev = hover !== null && previous ? previous[hover] : undefined
  const hNote = hover !== null ? notes.find((a) => a.i === hover) : undefined
  const tipLeft = hover !== null ? x(hover) : 0
  const flip = tipLeft > width * 0.6

  if (n === 0)
    return (
      <p className="py-10 text-center text-sm text-ink-muted">Aucune donnée sur cette période.</p>
    )

  return (
    <div className={cx('min-w-0', className)}>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <svg width="16" height="4" aria-hidden>
            <line
              x1="1"
              y1="2"
              x2="15"
              y2="2"
              stroke="var(--color-primary)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          {label}
        </span>
        {prevD && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="16" height="4" aria-hidden>
              <line
                x1="1"
                y1="2"
                x2="15"
                y2="2"
                stroke="var(--color-ink-muted)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
            </svg>
            {previousLabel}
          </span>
        )}
      </div>
      <div
        ref={wrapRef}
        className={cx(
          'relative rounded-sm transition-opacity outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary',
          pending && 'opacity-50'
        )}
        style={{ height }}
        tabIndex={0}
        role="img"
        aria-label={ariaLabel ?? autoAria}
        onKeyDown={onKey}
        onFocus={() => setHover((v) => v ?? n - 1)}
        onBlur={() => setHover(null)}
      >
        <svg width={width} height={height} className="block overflow-visible" aria-hidden>
          {ticks.map((t, i) => (
            <g key={t}>
              <line
                x1={m.left}
                x2={m.left + innerW}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <text
                x={m.left - 8}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-ink-muted text-[11px] tabular-nums"
              >
                {tickLabels[i]}
              </text>
            </g>
          ))}
          {xTicks.map((i, k) => (
            <text
              key={i}
              x={x(i)}
              y={height - 6}
              textAnchor={k === 0 ? 'start' : k === xTicks.length - 1 ? 'end' : 'middle'}
              className="fill-ink-muted text-[11px] tabular-nums"
            >
              {xFmt(series[i].date)}
            </text>
          ))}

          {notes.map((a) => {
            const ax = x(a.i)
            const anchor = ax < m.left + 60 ? 'start' : ax > m.left + innerW - 60 ? 'end' : 'middle'
            return (
              <g key={a.date}>
                <line
                  x1={ax}
                  x2={ax}
                  y1={14 + a.row * 12}
                  y2={m.top + innerH}
                  stroke="var(--color-ink-muted)"
                  strokeOpacity={0.45}
                  strokeWidth={1}
                />
                <text
                  x={ax}
                  y={10 + a.row * 12}
                  textAnchor={anchor}
                  className="fill-ink text-[11px] font-medium"
                >
                  {a.label}
                </text>
              </g>
            )
          })}

          {prevD && (
            <path
              d={prevD}
              fill="none"
              stroke="var(--color-ink-muted)"
              strokeOpacity={0.7}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              strokeLinejoin="round"
            />
          )}
          {baseline === 'zero' && (
            <motion.path
              key={`a${area}`}
              d={area}
              fill="var(--color-primary)"
              fillOpacity={0.1}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: duration.slow, ease: ease.out }}
            />
          )}
          <motion.path
            key={d}
            d={d}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: duration.story, ease: ease.out }}
          />
          {notes.map((a) => (
            <circle
              key={`d${a.date}`}
              cx={x(a.i)}
              cy={y(series[a.i].value)}
              r={4}
              fill="var(--color-ink)"
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          ))}
          <circle
            cx={x(n - 1)}
            cy={y(last)}
            r={4}
            fill="var(--color-primary)"
            stroke="var(--color-surface)"
            strokeWidth={2}
          />

          {h && hover !== null && (
            <g>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={m.top}
                y2={m.top + innerH}
                stroke="var(--color-ink)"
                strokeOpacity={0.35}
                strokeWidth={1}
              />
              {hPrev !== undefined && (
                <circle
                  cx={x(hover)}
                  cy={y(hPrev)}
                  r={3.5}
                  fill="var(--color-ink-muted)"
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                />
              )}
              <circle
                cx={x(hover)}
                cy={y(h.value)}
                r={5}
                fill="var(--color-primary)"
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
            </g>
          )}
          <rect
            x={m.left}
            y={0}
            width={innerW}
            height={height}
            fill="transparent"
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setHover(null)}
            style={{ touchAction: 'pan-y' }}
          />
        </svg>

        <AnimatePresence>
          {h && hover !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: duration.instant } }}
              transition={{ duration: duration.instant }}
              className="pointer-events-none absolute top-6 z-10 w-max max-w-[15rem] rounded-sm border border-line bg-surface px-3 py-2 text-xs shadow-card"
              style={flip ? { right: width - tipLeft + 12 } : { left: tipLeft + 12 }}
            >
              <p className="text-ink-muted">{fmtDateLong(h.date)}</p>
              <p className="mt-1 flex items-center gap-2">
                <svg width="12" height="4" aria-hidden>
                  <line
                    x1="1"
                    y1="2"
                    x2="11"
                    y2="2"
                    stroke="var(--color-primary)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-sm font-semibold text-ink tabular-nums">
                  {format(h.value)}
                </span>
                <span className="text-ink-muted">{label}</span>
              </p>
              {hPrev !== undefined && (
                <p className="mt-0.5 flex items-center gap-2">
                  <svg width="12" height="4" aria-hidden>
                    <line
                      x1="1"
                      y1="2"
                      x2="11"
                      y2="2"
                      stroke="var(--color-ink-muted)"
                      strokeWidth="1.5"
                      strokeDasharray="3 2"
                    />
                  </svg>
                  <span className="font-semibold text-ink tabular-nums">{format(hPrev)}</span>
                  <span className="text-ink-muted">
                    {previousLabel.toLowerCase()} ·{' '}
                    {fmtSignedPct(hPrev ? ((h.value - hPrev) / hPrev) * 100 : 0)}
                  </span>
                </p>
              )}
              {hNote && (
                <p className="mt-1.5 border-t border-line pt-1.5 text-ink">
                  <span className="font-medium">{hNote.label}</span>
                  {hNote.detail && <span className="text-ink-muted"> · {hNote.detail}</span>}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* valeur parcourue au clavier, lue par les lecteurs d'écran (l'info-bulle visuelle n'est pas annoncée) */}
      <p className="sr-only" aria-live="polite">
        {h
          ? `${fmtDateLong(h.date)} : ${format(h.value)}${hPrev !== undefined ? `, ${previousLabel.toLowerCase()} ${format(hPrev)}` : ''}${hNote ? `. ${hNote.label}` : ''}`
          : ''}
      </p>

      <details className="mt-3 text-xs text-ink-muted">
        <summary className="cursor-pointer select-none hover:text-ink">{tableLabel}</summary>
        <div className="mt-2 max-h-48 overflow-auto rounded-sm border border-line">
          <table className="w-full text-left tabular-nums">
            <thead className="sticky top-0 bg-surface-2 text-ink">
              <tr>
                <th className="px-2 py-1 font-medium">Date</th>
                <th className="px-2 py-1 text-right font-medium">{label}</th>
                {previous && <th className="px-2 py-1 text-right font-medium">{previousLabel}</th>}
              </tr>
            </thead>
            <tbody>
              {series.map((p, i) => (
                <tr key={p.date} className="border-t border-line">
                  <td className="px-2 py-1">{fmtDateLong(p.date)}</td>
                  <td className="px-2 py-1 text-right text-ink">{format(p.value)}</td>
                  {previous && (
                    <td className="px-2 py-1 text-right">
                      {previous[i] !== undefined ? format(previous[i]) : '–'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
