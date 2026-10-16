import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { AssistantAvatar } from '../../components/assistant_avatar'
import { useToast } from '../../components/toast'
import { duration, ease } from '../../motion'
import { cx } from '../../utils'
import { fmtHour, fmtNum, useWidth } from './shared'

export type PlanPoint = { h: number; kw: number; low: number; high: number }
export type PlanSlot = {
  id: string
  /** Équipement (une ligne par équipement). */
  appliance: string
  start: number
  end: number
  kwh: number
  /** « charge » = Robin consomme le soleil ; « pause » = Robin efface pendant la pointe. */
  kind?: 'charge' | 'pause'
  /** Phrase courte affichée dans le détail. */
  what: string
  why: string
}

const curve = (h: number) => {
  // cloche de production d'octobre, 6 kWc, ciel dégagé (crête ≈ 4,3 kW vers 13h30)
  const x = (h - 13.5) / 3.1
  return Math.max(0, 4.3 * Math.exp(-x * x))
}
export const DEFAULT_PLAN_CURVE: PlanPoint[] = Array.from({ length: 27 }, (_, i) => {
  const h = 7.5 + i * 0.5
  const kw = curve(h)
  return {
    h,
    kw: +kw.toFixed(2),
    low: +(kw * 0.72).toFixed(2),
    high: +Math.min(5.4, kw * 1.12).toFixed(2),
  }
})

export const DEFAULT_PLAN_SLOTS: PlanSlot[] = [
  {
    id: 'ce',
    appliance: 'Chauffe-eau',
    start: 11,
    end: 13,
    kwh: 4.2,
    what: 'Le ballon passe de 46 à 60 °C.',
    why: 'C’est le début du pic prévu (3,6 à 4,3 kW) : la maison n’en consomme que 0,6. Douches chaudes ce soir et demain matin, sans acheter un kWh.',
  },
  {
    id: 've',
    appliance: 'Voiture',
    start: 12.5,
    end: 15.5,
    kwh: 5.4,
    what: 'La voiture passe de 42 à 53 %, puissance modulée sur le surplus.',
    why: 'Une fois le ballon chaud, le surplus reste au-dessus de 1,5 kW jusqu’à 15h30. Les 80 % de vendredi 8h seront complétés cette nuit avec votre batterie virtuelle.',
  },
  {
    id: 'pac',
    appliance: 'PAC',
    start: 14,
    end: 16,
    kwh: 2.4,
    what: 'Préchauffage de 20 à 21 °C.',
    why: 'La maison stocke la chaleur du soleil de l’après-midi : à 18h, Robin pourra baisser la PAC sans que vous le sentiez.',
  },
  {
    id: 'pac-pause',
    appliance: 'PAC',
    start: 18,
    end: 20,
    kwh: 2.6,
    kind: 'pause',
    what: 'PAC au ralenti pendant la pointe du réseau, +1,20 € estimés.',
    why: 'L’électricité est la plus chère et la plus carbonée entre 18h et 20h. Votre logement reste au-dessus de 19 °C, sinon Robin rend la main.',
  },
]

/**
 * « Plan de Robin pour demain » : courbe de production prévue (avec sa fourchette d'incertitude) et
 * créneaux réservés par équipement sur le même axe horaire. Chaque créneau s'explique au survol, au
 * focus ou au clic, et peut être retiré du plan (annulable).
 * Friction traitée : un automatisme invisible inspire la méfiance (« qu'est-ce qu'il fait chez moi ? ») ;
 * nommé, montré et expliqué, il devient une protection qu'on comprend.
 * Pattern : P15 (Tesla Storm Watch, Engie GreenPlay).
 */
export function RobinPlanTomorrow({
  points = DEFAULT_PLAN_CURVE,
  slots = DEFAULT_PLAN_SLOTS,
  dayLabel = 'Jeudi 15 octobre',
  summary = 'Grand soleil prévu : 23 kWh de production. J’ai réservé 12 kWh pour vos équipements.',
  from = 7,
  to = 21,
  className,
}: {
  points?: PlanPoint[]
  slots?: PlanSlot[]
  dayLabel?: string
  summary?: string
  /** Bornes de l'axe horaire. */
  from?: number
  to?: number
  className?: string
}) {
  const toast = useToast()
  const reduce = useReducedMotion()
  const [ref, width] = useWidth<HTMLDivElement>()
  const [selected, setSelected] = useState<string | null>(slots[0]?.id ?? null)
  const [hoverH, setHoverH] = useState<number | null>(null)
  const [skipped, setSkipped] = useState<Set<string>>(new Set())

  const lanes = useMemo(() => Array.from(new Set(slots.map((s) => s.appliance))), [slots])
  const M = { l: 30, r: 10, t: 12 }
  const chartH = 140
  const laneH = 32
  const axisH = 22
  const H = M.t + chartH + axisH + lanes.length * laneH + 4
  const W = Math.max(280, width)
  const iw = W - M.l - M.r
  const maxKw = Math.max(5, ...points.map((p) => p.high))
  const x = (h: number) => M.l + ((h - from) / (to - from)) * iw
  const y = (kw: number) => M.t + chartH - (kw / maxKw) * chartH
  const base = M.t + chartH

  const linePath = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.h).toFixed(1)},${y(p.kw).toFixed(1)}`)
    .join('')
  const areaPath = `${linePath}L${x(points[points.length - 1].h).toFixed(1)},${base}L${x(points[0].h).toFixed(1)},${base}Z`
  const bandPath =
    points.map((p, i) => `${i ? 'L' : 'M'}${x(p.h).toFixed(1)},${y(p.high).toFixed(1)}`).join('') +
    [...points]
      .reverse()
      .map((p) => `L${x(p.h).toFixed(1)},${y(p.low).toFixed(1)}`)
      .join('') +
    'Z'
  const xTicks = Array.from(
    { length: Math.floor((to - from) / 2) + 1 },
    (_, i) => from + 1 + i * 2
  ).filter((h) => h < to)
  const yTicks = [0, 2, 4].filter((v) => v <= maxKw)

  const sel = slots.find((s) => s.id === selected) ?? null
  const hoverPoint =
    hoverH !== null
      ? points.reduce(
          (a, p) => (Math.abs(p.h - hoverH) < Math.abs(a.h - hoverH) ? p : a),
          points[0]
        )
      : null
  const activeAt = (h: number) =>
    slots.filter((s) => !skipped.has(s.id) && h >= s.start && h < s.end)

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const h = from + ((e.clientX - r.left) / r.width) * (to - from)
    setHoverH(Math.round(h * 2) / 2)
  }
  const onSlotKey = (e: KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setSelected(id)
    }
  }
  const toggleSkip = (s: PlanSlot) => {
    const isSkipped = skipped.has(s.id)
    const next = new Set(skipped)
    if (isSkipped) next.delete(s.id)
    else next.add(s.id)
    setSkipped(next)
    toast({
      message: isSkipped
        ? `${s.appliance} ${fmtHour(s.start)}-${fmtHour(s.end)} remis dans le plan.`
        : `${s.appliance} ${fmtHour(s.start)}-${fmtHour(s.end)} retiré du plan. Robin ne touchera pas à cet équipement sur ce créneau.`,
      actionLabel: 'Annuler',
      onAction: () => setSkipped(skipped),
    })
  }

  return (
    <div
      className={cx('rounded-lg border border-line bg-surface p-4 shadow-card sm:p-5', className)}
    >
      <div className="flex items-start gap-3">
        <AssistantAvatar mood="working" size={40} />
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            Plan de Robin · {dayLabel}
          </p>
          <p className="mt-0.5 text-[15px] leading-snug font-medium text-ink">{summary}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted" aria-hidden>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-solar" /> Production prévue
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-4 rounded-[2px]"
            style={{ background: 'color-mix(in oklab, var(--color-solar) 22%, transparent)' }}
          />{' '}
          Fourchette (80 % de confiance)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-[2px] bg-home" /> Créneau piloté
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-[2px] border-[1.5px] border-dashed border-home" />{' '}
          Pause pendant la pointe
        </span>
      </div>

      <div ref={ref} className="relative mt-2 w-full">
        <svg
          width={W}
          height={H}
          className="block max-w-full"
          role="img"
          aria-label={`Production prévue ${dayLabel}, crête ${fmtNum(Math.max(...points.map((p) => p.kw)), 1)} kW, et ${slots.length} créneaux pilotés`}
        >
          {/* grille et axe Y */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={M.l}
                x2={W - M.r}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--color-line)"
                strokeWidth="1"
              />
              <text
                x={M.l - 6}
                y={y(v) + 3.5}
                textAnchor="end"
                fontSize="10"
                fill="var(--color-ink-muted)"
              >
                {v}
              </text>
            </g>
          ))}
          <text
            x={M.l - 6}
            y={M.t - 2}
            textAnchor="end"
            fontSize="10"
            fill="var(--color-ink-muted)"
          >
            kW
          </text>

          {/* créneau sélectionné / survolé : bande verticale discrète */}
          {sel && !skipped.has(sel.id) && (
            <rect
              x={x(sel.start)}
              y={M.t}
              width={x(sel.end) - x(sel.start)}
              height={chartH}
              fill="var(--color-home)"
              opacity="0.06"
            />
          )}

          <path d={bandPath} fill="color-mix(in oklab, var(--color-solar) 22%, transparent)" />
          <path d={areaPath} fill="color-mix(in oklab, var(--color-solar) 12%, transparent)" />
          <motion.path
            d={linePath}
            fill="none"
            stroke="var(--color-solar)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: reduce ? 1 : 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: reduce ? 0 : 1, ease: ease.out }}
          />

          {/* axe X */}
          {xTicks.map((h) => (
            <text
              key={h}
              x={x(h)}
              y={base + 15}
              textAnchor="middle"
              fontSize="10"
              fill="var(--color-ink-muted)"
            >
              {fmtHour(h)}
            </text>
          ))}

          {/* crosshair */}
          {hoverPoint && (
            <g pointerEvents="none">
              <line
                x1={x(hoverPoint.h)}
                x2={x(hoverPoint.h)}
                y1={M.t}
                y2={H - 4}
                stroke="var(--color-ink)"
                strokeOpacity="0.35"
                strokeWidth="1"
              />
              <circle
                cx={x(hoverPoint.h)}
                cy={y(hoverPoint.kw)}
                r="4.5"
                fill="var(--color-solar)"
                stroke="var(--color-surface)"
                strokeWidth="2"
              />
            </g>
          )}
          <rect
            x={M.l}
            y={M.t}
            width={iw}
            height={chartH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHoverH(null)}
          />

          {/* lignes d'équipements */}
          {lanes.map((lane, li) => {
            const ly = base + axisH + li * laneH
            return (
              <g key={lane}>
                <line
                  x1={M.l}
                  x2={W - M.r}
                  y1={ly + laneH - 2}
                  y2={ly + laneH - 2}
                  stroke="var(--color-line)"
                  strokeWidth="1"
                />
                <text x={M.l} y={ly + 9} fontSize="10.5" fontWeight="600" fill="var(--color-ink)">
                  {lane}
                </text>
                {slots
                  .filter((s) => s.appliance === lane)
                  .map((s) => {
                    const isSel = selected === s.id
                    const isSkip = skipped.has(s.id)
                    const bx = x(s.start)
                    const bw = Math.max(6, x(s.end) - x(s.start))
                    const by = ly + 13
                    return (
                      <g
                        key={s.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSel}
                        aria-label={`${s.appliance}, ${fmtHour(s.start)}-${fmtHour(s.end)}, ${s.kind === 'pause' ? 'pause' : `${fmtNum(s.kwh, 1)} kWh`}${isSkip ? ', retiré du plan' : ''}. ${s.what}`}
                        onClick={() => setSelected(s.id)}
                        onKeyDown={(e) => onSlotKey(e, s.id)}
                        onPointerEnter={() => setSelected(s.id)}
                        className="cursor-pointer outline-none [&:focus-visible>rect:last-of-type]:stroke-primary"
                      >
                        <rect x={bx - 2} y={by - 5} width={bw + 4} height={22} fill="transparent" />
                        <rect
                          x={bx}
                          y={by}
                          width={bw}
                          height={12}
                          rx={4}
                          fill={
                            isSkip
                              ? 'var(--color-surface-2)'
                              : s.kind === 'pause'
                                ? 'color-mix(in oklab, var(--color-home) 10%, var(--color-surface))'
                                : 'var(--color-home)'
                          }
                          stroke={
                            isSel
                              ? 'var(--color-ink)'
                              : s.kind === 'pause' || isSkip
                                ? 'var(--color-home)'
                                : 'none'
                          }
                          strokeWidth={isSel ? 2 : 1.5}
                          strokeDasharray={s.kind === 'pause' || isSkip ? '4 3' : undefined}
                          opacity={isSkip ? 0.7 : 1}
                        />
                      </g>
                    )
                  })}
              </g>
            )
          })}
        </svg>

        {hoverPoint && (
          <div
            className="pointer-events-none absolute z-10 w-48 rounded-sm bg-ink px-3 py-2 text-xs text-canvas shadow-card"
            style={{ left: Math.min(Math.max(0, x(hoverPoint.h) - 96), W - 192), top: 0 }}
            role="status"
          >
            <p>
              <strong className="text-sm tabular-nums">{fmtNum(hoverPoint.kw, 1)} kW</strong>{' '}
              <span className="opacity-80">à {fmtHour(hoverPoint.h)}</span>
            </p>
            <p className="opacity-80 tabular-nums">
              fourchette {fmtNum(hoverPoint.low, 1)}-{fmtNum(hoverPoint.high, 1)} kW
            </p>
            <p className="mt-0.5 opacity-90">
              {activeAt(hoverPoint.h).length
                ? activeAt(hoverPoint.h)
                    .map((s) => s.appliance + (s.kind === 'pause' ? ' (pause)' : ''))
                    .join(', ')
                : 'Aucun pilotage'}
            </p>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {sel && (
          <motion.div
            key={sel.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast, ease: ease.out }}
            className="mt-3 rounded-md bg-surface-2 px-3 py-3 text-sm"
            aria-live="polite"
          >
            <p className="font-semibold text-ink">
              {sel.appliance} · {fmtHour(sel.start)}-{fmtHour(sel.end)}
              {sel.kind !== 'pause' && (
                <span className="font-normal text-ink-muted">
                  {' '}
                  · {fmtNum(sel.kwh, 1)} kWh solaires
                </span>
              )}
              {skipped.has(sel.id) && (
                <span className="font-normal text-ink-muted"> · retiré du plan</span>
              )}
            </p>
            <p className="mt-1 text-ink">{sel.what}</p>
            <p className="mt-1 text-ink-muted">
              <span className="font-medium text-ink">Pourquoi : </span>
              {sel.why}
            </p>
            <button
              type="button"
              onClick={() => toggleSkip(sel)}
              className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {skipped.has(sel.id) ? 'Remettre dans le plan' : 'Ne pas piloter ce créneau'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
