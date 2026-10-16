import { motion, useInView, useReducedMotion } from 'motion/react'
import { useRef, type PointerEvent } from 'react'
import { AnimatedNumber } from '../../components/animated_number'
import { NudgeBanner } from '../../components/conversion'
import { Term, WhyThis } from '../../components/explain'
import { GoalRing } from '../../components/goal_ring'
import { duration, ease } from '../../motion'
import { cx, formatEuro } from '../../utils'
import {
  ChartTooltip,
  TipRow,
  addDays,
  daysBetween,
  fmtDate,
  fmtKwh,
  fmtNum,
  parseIso,
  useArrowIndex,
  useElementWidth,
} from './shared'

/** Relevé du solde de la batterie virtuelle (kWh) à une date ISO. */
export type StockPoint = { date: string; kwh: number }

/* Famille Martin : surplus déposé de juin à mi-septembre, puis retraits du soir. Relevés hebdomadaires. */
const DEFAULT_HISTORY: StockPoint[] = [
  ['2026-06-01', 0],
  ['2026-06-15', 34],
  ['2026-07-01', 78],
  ['2026-07-15', 121],
  ['2026-08-01', 168],
  ['2026-08-15', 205],
  ['2026-09-01', 232],
  ['2026-09-15', 241],
  ['2026-10-01', 206],
  ['2026-10-14', 186],
].map(([date, kwh]) => ({ date: date as string, kwh: kwh as number }))

const DEFAULT_LABELS = {
  balance: 'Solde de votre batterie virtuelle',
  termDef:
    'Votre surplus solaire d’été, gardé en kWh chez mylight150 et restitué quand vos panneaux ne suffisent plus. Comme un compte épargne, mais en kWh.',
  capacityLabel: (c: number) => `sur ${fmtNum(c)} kWh`,
  lasts: 'Au rythme actuel, votre stock tiendra jusqu’au',
  planned: 'Prévu à l’ouverture du compte :',
  alertTitle: 'Votre stock baisse plus vite que prévu',
  alertText: (rate: string, planned: string) =>
    `Vous retirez ${rate} par jour, contre ${planned} prévus : la pompe à chaleur tourne surtout le soir.`,
  okText: 'Votre stock suit la prévision. On vous prévient s’il accélère.',
  actionTitle: 'Programmer la PAC sur les heures de midi',
  actionText: (date: string) =>
    `Robin préchauffe la maison avec le soleil : votre stock tiendrait jusqu’au ${date}.`,
  actionCta: 'Activer',
  chartLabel: 'Évolution et projection du solde',
  today: 'aujourd’hui',
}

/**
 * La batterie virtuelle vue comme un compte épargne en kWh : solde, jauge de capacité, valeur en €,
 * courbe historique + projection, date d'épuisement (« tiendra jusqu'au 12 février »),
 * alerte proactive si le stock baisse plus vite que prévu, avec l'action qui corrige.
 *
 * Friction traitée : on ne sait pas si le surplus d'été suffira pour l'hiver ; on découvre trop tard qu'on rachète au réseau. Prévenir avant la mauvaise surprise.
 * Pattern : P8 (Hello Watt budget et alertes, Loop UK) + white space n°1 du benchmark (batterie virtuelle = compte épargne en kWh)
 */
export function VirtualStockForecast({
  history = DEFAULT_HISTORY,
  capacityKwh = 300,
  /** Retrait moyen actuel (kWh/jour), mesuré sur les 14 derniers jours. Par défaut : pente des deux derniers relevés. */
  currentRate,
  plannedRate = 1.15,
  /** Retrait si l'action proposée est activée (kWh/jour). */
  actionRate = 1.3,
  gridPrice = 0.1952,
  horizon = '2026-04-30',
  onAction,
  labels,
  className,
}: {
  history?: StockPoint[]
  capacityKwh?: number
  currentRate?: number
  plannedRate?: number
  actionRate?: number
  gridPrice?: number
  /** Dernière date affichée sur la courbe. */
  horizon?: string
  onAction?: () => void
  labels?: Partial<typeof DEFAULT_LABELS>
  className?: string
}) {
  const l = { ...DEFAULT_LABELS, ...labels }
  const reduce = useReducedMotion()
  const last = history[history.length - 1]
  const prev = history[history.length - 2] ?? last
  const rate =
    currentRate ??
    Math.max(0.01, (prev.kwh - last.kwh) / Math.max(1, daysBetween(prev.date, last.date)))
  const today = last.date
  const endDate = addDays(today, last.kwh / rate)
  const plannedEnd = addDays(today, last.kwh / plannedRate)
  const actionEnd = addDays(today, last.kwh / actionRate)
  const fasterThanPlanned = rate > plannedRate * 1.1
  const value = last.kwh * gridPrice

  /* --- Courbe --- */
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(560)
  const svgRef = useRef<SVGSVGElement>(null)
  const inView = useInView(svgRef, { once: true })
  const H = 200
  const pad = { l: 34, r: 12, t: 16, b: 26 }
  const t0 = parseIso(history[0].date)
  const t1 = Math.max(parseIso(horizon), parseIso(plannedEnd))
  const x = (iso: string) => pad.l + ((parseIso(iso) - t0) / (t1 - t0)) * (width - pad.l - pad.r)
  const maxY = Math.ceil(Math.max(capacityKwh, ...history.map((p) => p.kwh)) / 100) * 100
  const y = (v: number) => pad.t + (1 - v / maxY) * (H - pad.t - pad.b)
  const histPath = history
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)} ${y(p.kwh).toFixed(1)}`)
    .join(' ')
  const histArea = `${histPath} L${x(today)} ${y(0)} L${x(history[0].date)} ${y(0)} Z`
  const projPath = `M${x(today)} ${y(last.kwh)} L${x(endDate)} ${y(0)}`
  const plannedPath = `M${x(today)} ${y(last.kwh)} L${x(plannedEnd)} ${y(0)}`

  // Points de lecture pour le survol / clavier : relevés + projection mensuelle.
  const readings: { date: string; kwh: number; planned?: number; kind: 'past' | 'proj' }[] = [
    ...history.map((p) => ({ ...p, kind: 'past' as const })),
    ...monthStarts(today, endDate).map((d) => {
      const days = daysBetween(today, d)
      return {
        date: d,
        kwh: Math.max(0, last.kwh - rate * days),
        planned: Math.max(0, last.kwh - plannedRate * days),
        kind: 'proj' as const,
      }
    }),
    {
      date: endDate,
      kwh: 0,
      planned: Math.max(0, last.kwh - plannedRate * daysBetween(today, endDate)),
      kind: 'proj' as const,
    },
  ]
  const { index, setIndex, onKeyDown, onBlur } = useArrowIndex(readings.length)
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left
    let best = 0
    readings.forEach((p, i) => {
      if (Math.abs(x(p.date) - px) < Math.abs(x(readings[best].date) - px)) best = i
    })
    setIndex(best)
  }
  const months = [
    history[0].date.slice(0, 8) + '01',
    ...monthStarts(history[0].date, addDays(history[0].date, (t1 - t0) / 86_400_000)),
  ]
    .filter((m) => parseIso(m) >= t0 && x(m) < width - pad.r - 10)
    .filter((_, i) => width >= 480 || i % 2 === 0)

  const aria = `${l.chartLabel} : ${fmtKwh(last.kwh)} le ${fmtDate(today)}, sur ${fmtKwh(capacityKwh)}. Au rythme actuel de ${fmtKwh(rate, 1)} par jour, stock épuisé le ${fmtDate(
    endDate
  )} ; prévu initialement le ${fmtDate(plannedEnd)}. Flèches pour parcourir.`

  return (
    <div className={cx('flex flex-col gap-5', className)}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div
          role="img"
          aria-label={`${l.balance} : ${fmtKwh(last.kwh)} ${l.capacityLabel(capacityKwh)}`}
          className="shrink-0 self-center"
        >
          <GoalRing
            value={(last.kwh / capacityKwh) * 100}
            size={132}
            stroke={11}
            color="var(--color-battery)"
            celebrate={false}
          >
            <div aria-hidden>
              <p className="font-display text-2xl font-semibold">
                <AnimatedNumber value={last.kwh} />
                <span className="text-sm font-normal text-ink-muted"> kWh</span>
              </p>
              <p className="text-xs text-ink-muted">{l.capacityLabel(capacityKwh)}</p>
            </div>
          </GoalRing>
        </div>
        <div className="min-w-0">
          <p className="text-sm text-ink-muted">
            <Term def={l.termDef}>{l.balance}</Term> · {fmtDate(today)}
          </p>
          <p className="mt-1 font-display text-2xl leading-tight tracking-[-0.02em]">
            {l.lasts} <span className="font-semibold">{fmtDate(endDate)}</span>
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {l.planned} {fmtDate(plannedEnd)} · valeur ≈{' '}
            <span className="font-medium text-ink">{formatEuro(value)}</span> d’électricité réseau
          </p>
        </div>
      </div>

      <div ref={wrapRef} className="relative">
        <svg
          ref={svgRef}
          width={width}
          height={H}
          role="img"
          aria-label={aria}
          tabIndex={0}
          onPointerMove={onMove}
          onPointerLeave={() => setIndex(null)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          className="block touch-pan-y rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
        >
          {[0, maxY / 2, maxY].map((t) => (
            <g key={t}>
              <line
                x1={pad.l}
                x2={width - pad.r}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--color-line)"
                opacity={t === 0 ? 1 : 0.6}
              />
              <text
                x={pad.l - 6}
                y={y(t) + 3.5}
                textAnchor="end"
                fontSize={10}
                fill="var(--color-ink-muted)"
              >
                {fmtNum(t)}
              </text>
            </g>
          ))}
          {months.map((m) => (
            <text
              key={m}
              x={x(m)}
              y={H - 8}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-ink-muted)"
            >
              {fmtDate(m, { month: 'short' }).replace('.', '')}
            </text>
          ))}
          {/* Capacité du contrat */}
          <text
            x={width - pad.r}
            y={y(capacityKwh) - 5}
            textAnchor="end"
            fontSize={10}
            fill="var(--color-ink-muted)"
          >
            capacité {fmtNum(capacityKwh)} kWh
          </text>
          <line
            x1={pad.l}
            x2={width - pad.r}
            y1={y(capacityKwh)}
            y2={y(capacityKwh)}
            stroke="var(--color-battery)"
            opacity={0.4}
          />

          <path d={histArea} fill="var(--color-battery)" opacity={0.1} />
          <motion.path
            d={histPath}
            fill="none"
            stroke="var(--color-battery)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: inView ? 1 : 0 }}
            transition={{ duration: reduce ? 0 : duration.story, ease: ease.out }}
          />
          {/* Prévu (référence neutre) puis projection au rythme actuel (même teinte que l'historique, atténuée) */}
          <path
            d={plannedPath}
            fill="none"
            stroke="var(--color-ink-muted)"
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.7}
          />
          <motion.path
            d={projPath}
            fill="none"
            stroke={fasterThanPlanned ? 'var(--color-warning)' : 'var(--color-battery)'}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="1 5"
            initial={{ opacity: 0 }}
            animate={{ opacity: inView ? 1 : 0 }}
            transition={{
              duration: reduce ? 0 : duration.slow,
              delay: reduce ? 0 : duration.story,
              ease: ease.out,
            }}
          />
          <line
            x1={x(today)}
            x2={x(today)}
            y1={pad.t}
            y2={y(0)}
            stroke="var(--color-ink)"
            strokeWidth={1}
            opacity={0.5}
          />
          <text
            x={x(today) + 4}
            y={pad.t + 8}
            fontSize={10}
            fill="var(--color-ink)"
            stroke="var(--color-surface)"
            strokeWidth={3}
            paintOrder="stroke"
          >
            {l.today}
          </text>
          <circle
            cx={x(today)}
            cy={y(last.kwh)}
            r={4.5}
            fill="var(--color-battery)"
            stroke="var(--color-surface)"
            strokeWidth={2}
          />
          <circle
            cx={x(endDate)}
            cy={y(0)}
            r={4.5}
            fill={fasterThanPlanned ? 'var(--color-warning)' : 'var(--color-battery)'}
            stroke="var(--color-surface)"
            strokeWidth={2}
          />
          <text
            x={x(endDate) - 6}
            y={y(0) - 10}
            textAnchor="end"
            fontSize={11}
            fontWeight={600}
            fill="var(--color-ink)"
            stroke="var(--color-surface)"
            strokeWidth={3}
            paintOrder="stroke"
          >
            {fmtDate(endDate, { day: 'numeric', month: 'short' })}
          </text>

          {index !== null && readings[index] && (
            <g pointerEvents="none">
              <line
                x1={x(readings[index].date)}
                x2={x(readings[index].date)}
                y1={pad.t}
                y2={y(0)}
                stroke="var(--color-ink-muted)"
              />
              <circle
                cx={x(readings[index].date)}
                cy={y(readings[index].kwh)}
                r={4.5}
                fill="var(--color-battery)"
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>
        <ChartTooltip
          show={index !== null}
          x={index !== null ? x(readings[index].date) : 0}
          y={-8}
          width={width}
        >
          {index !== null && readings[index] && (
            <>
              <p className="mb-1 font-medium">
                {fmtDate(readings[index].date, { day: 'numeric', month: 'long' })}
                {readings[index].kind === 'proj' && (
                  <span className="font-normal text-ink-muted"> · projection</span>
                )}
              </p>
              <TipRow
                color={
                  readings[index].kind === 'proj' && fasterThanPlanned
                    ? 'var(--color-warning)'
                    : 'var(--color-battery)'
                }
                value={fmtKwh(readings[index].kwh)}
                label={readings[index].kind === 'proj' ? 'au rythme actuel' : 'solde'}
              />
              {readings[index].planned !== undefined && (
                <TipRow
                  color="var(--color-ink-muted)"
                  value={fmtKwh(readings[index].planned ?? 0)}
                  label="prévu"
                />
              )}
            </>
          )}
        </ChartTooltip>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted" aria-hidden>
          <li className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-battery" />
            Solde
          </li>
          <li className="flex items-center gap-1.5">
            <span
              className={cx(
                'h-0.5 w-4 rounded-full',
                fasterThanPlanned ? 'bg-warning' : 'bg-battery'
              )}
            />
            Projection au rythme actuel
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-ink-muted" />
            Prévision initiale
          </li>
        </ul>
      </div>

      {fasterThanPlanned ? (
        <div className="space-y-3">
          <div
            role="alert"
            className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 p-4"
          >
            <svg
              viewBox="0 0 16 16"
              className="mt-0.5 size-4 shrink-0"
              fill="none"
              stroke="var(--color-warning)"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M8 2 L14.5 13.5 H1.5 Z" strokeLinejoin="round" />
              <path d="M8 6.5 V9.5 M8 11.6 V11.7" />
            </svg>
            <div className="text-sm">
              <p className="font-semibold text-ink">{l.alertTitle}</p>
              <p className="mt-0.5 text-ink-muted">
                {l.alertText(fmtKwh(rate, 1), fmtKwh(plannedRate, 1))}
              </p>
            </div>
          </div>
          <NudgeBanner
            title={l.actionTitle}
            text={l.actionText(fmtDate(actionEnd))}
            ctaLabel={l.actionCta}
            onCta={onAction}
          />
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <span className="size-2 rounded-full bg-success" aria-hidden />
          {l.okText}
        </p>
      )}

      <WhyThis
        hypotheses={[
          { label: 'Solde au ' + fmtDate(today), value: fmtKwh(last.kwh) },
          { label: 'Retrait actuel (14 j)', value: `${fmtKwh(rate, 2)} / jour` },
          { label: 'Retrait prévu', value: `${fmtKwh(plannedRate, 2)} / jour` },
          { label: 'Valeur au prix réseau', value: `${fmtNum(gridPrice, 4)} € / kWh` },
        ]}
        source="Projection linéaire au rythme des 14 derniers jours ; recalculée chaque matin par Robin."
      />
    </div>
  )
}

/** 1ᵉʳ de chaque mois strictement après `from` et jusqu'à `to` inclus. */
function monthStarts(from: string, to: string) {
  const out: string[] = []
  let [y, m] = from.split('-').map(Number)
  for (let i = 0; i < 24; i++) {
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
    const iso = `${y}-${String(m).padStart(2, '0')}-01`
    if (iso > to) break
    out.push(iso)
  }
  return out
}
