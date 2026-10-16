import { motion, useInView, useReducedMotion } from 'motion/react'
import { useRef } from 'react'
import { Term } from '../../components/explain'
import { duration, ease } from '../../motion'
import { cx } from '../../utils'
import {
  ChartTooltip,
  DataTable,
  TipRow,
  fmtDate,
  fmtKwh,
  fmtNum,
  useArrowIndex,
  useElementWidth,
} from './shared'

/** Un jour : production mesurée et ensoleillement (heures de soleil équivalent plein). */
export type WeatherDay = { date: string; kwh: number; sunHours: number }

/* 1er → 14 octobre 2026, 6 kWc à Villeurbanne. Le 9 est couvert toute la journée. */
const DEFAULT_DAYS: WeatherDay[] = [
  [17.8, 4.4],
  [16.9, 4.2],
  [12.1, 3.0],
  [9.6, 2.5],
  [15.2, 3.8],
  [18.4, 4.5],
  [17.1, 4.3],
  [11.4, 2.9],
  [4.1, 1.05],
  [8.3, 2.1],
  [14.6, 3.6],
  [17.5, 4.4],
  [18.2, 4.6],
  [16.4, 4.1],
].map(([kwh, sunHours], i) => ({
  date: `2026-10-${String(i + 1).padStart(2, '0')}`,
  kwh,
  sunHours,
}))

const DEFAULT_LABELS = {
  bars: 'Production',
  line: 'Attendu selon l’ensoleillement',
  lineDef:
    "L'ensoleillement mesuré par Météo-France près de chez vous, converti en kWh que vos panneaux devraient produire ce jour-là. Si la barre touche la ligne, votre installation va bien.",
  cloudy: 'Journée nuageuse : votre installation va bien',
  check: 'Production plus basse que prévu : on vérifie votre installation',
}

/**
 * Production journalière (barres) superposée à l'ensoleillement (ligne), sur un seul axe en kWh :
 * l'ensoleillement est converti en « production attendue », ce qui évite un double axe trompeur.
 * Le jour le plus faible est annoté : nuageux mais conforme → rassurant ; sous l'attendu → alerte.
 *
 * Friction traitée : un jour à 4 kWh fait craindre une panne ; la météo explique la baisse au lieu d'inquiéter.
 * Pattern : P7 (Hello Watt / EDF & Moi, conso superposée à la température)
 */
export function ProductionWeatherChart({
  days = DEFAULT_DAYS,
  kwc = 6,
  /** kWh produits par kWc et par heure de soleil (rendement global, ~0,7 en octobre). */
  performanceRatio = 0.68,
  /** En dessous de cette part de l'attendu, on alerte au lieu de rassurer. */
  alertRatio = 0.75,
  labels,
  className,
}: {
  days?: WeatherDay[]
  kwc?: number
  performanceRatio?: number
  alertRatio?: number
  labels?: Partial<typeof DEFAULT_LABELS>
  className?: string
}) {
  const l = { ...DEFAULT_LABELS, ...labels }
  const reduce = useReducedMotion()
  const svgRef = useRef<SVGSVGElement>(null)
  const inView = useInView(svgRef, { once: true })
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(640)
  const { index, setIndex, onKeyDown, onBlur } = useArrowIndex(days.length)

  const data = days.map((d) => ({ ...d, expected: d.sunHours * kwc * performanceRatio }))
  const weakest = data.reduce((m, d, i) => (d.kwh < data[m].kwh ? i : m), 0)
  const weak = data[weakest]
  const weakOk = weak ? weak.kwh >= weak.expected * alertRatio : true

  const H = 230
  const pad = { l: 34, r: 8, t: 58, b: 24 }
  const max = Math.ceil(Math.max(...data.map((d) => Math.max(d.kwh, d.expected)), 1) / 5) * 5
  const plotW = width - pad.l - pad.r
  const band = plotW / Math.max(1, data.length)
  const barW = Math.min(24, band * 0.62)
  const bandX = (i: number) => pad.l + band * (i + 0.5)
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b)
  const base = y(0)
  const line = data
    .map((d, i) => `${i ? 'L' : 'M'}${bandX(i).toFixed(1)} ${y(d.expected).toFixed(1)}`)
    .join(' ')
  const ticks = Array.from({ length: max / 5 + 1 }, (_, i) => i * 5).filter(
    (t, _, a) => a.length <= 6 || t % 10 === 0
  )
  const labelEvery = width < 480 ? 3 : 1

  // Annotation : boîte au-dessus du graphique, reliée au jour faible par un trait.
  const annX = bandX(weakest)
  const annW = Math.min(230, width - 16)
  const annLeft = Math.max(8, Math.min(width - annW - 8, annX - annW / 2))

  const aria = `${l.bars} journalière du ${fmtDate(data[0]?.date ?? '2026-10-01')} au ${fmtDate(data[data.length - 1]?.date ?? '2026-10-01')}, de ${fmtKwh(
    Math.min(...data.map((d) => d.kwh)),
    1
  )} à ${fmtKwh(Math.max(...data.map((d) => d.kwh)), 1)}, comparée à la production attendue selon l'ensoleillement. Le ${fmtDate(weak.date)} : ${fmtKwh(weak.kwh, 1)} pour ${fmtKwh(
    weak.expected,
    1
  )} attendus, ${weakOk ? l.cloudy : l.check}. Flèches pour parcourir les jours.`

  return (
    <div className={cx('flex flex-col gap-3', className)}>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted" aria-hidden>
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2 rounded-[2px] bg-solar" />
          {l.bars} (kWh)
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-ink-muted" />
          <Term def={l.lineDef}>{l.line}</Term>
        </li>
      </ul>

      <div ref={wrapRef} className="relative">
        <svg
          ref={svgRef}
          width={width}
          height={H}
          role="img"
          aria-label={aria}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          onPointerLeave={() => setIndex(null)}
          className="block touch-pan-y rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={pad.l}
                x2={width - pad.r}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--color-line)"
                strokeWidth={1}
                opacity={t === 0 ? 1 : 0.6}
              />
              <text
                x={pad.l - 6}
                y={y(t) + 3.5}
                textAnchor="end"
                fontSize={10}
                fill="var(--color-ink-muted)"
                className="tabular-nums"
              >
                {t}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const h = base - y(d.kwh)
            const isWeak = i === weakest
            const active = index === i
            return (
              <g key={d.date} onPointerEnter={() => setIndex(i)}>
                <rect
                  x={bandX(i) - band / 2}
                  y={pad.t - 10}
                  width={band}
                  height={base - pad.t + 10}
                  fill="transparent"
                />
                <motion.path
                  d={barPath(bandX(i) - barW / 2, base, barW, Math.max(1, h))}
                  fill="var(--color-solar)"
                  initial={false}
                  animate={{
                    opacity: index !== null && !active ? 0.45 : isWeak && !weakOk ? 0.75 : 1,
                    scaleY: inView ? 1 : 0,
                  }}
                  style={{ originY: 1, transformBox: 'fill-box' }}
                  transition={{
                    duration: reduce ? 0 : duration.slow,
                    delay: reduce || !inView ? 0 : i * 0.025,
                    ease: ease.out,
                  }}
                />
                {i % labelEvery === 0 && (
                  <text
                    x={bandX(i)}
                    y={H - 8}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--color-ink-muted)"
                  >
                    {Number(d.date.slice(8))}
                  </text>
                )}
              </g>
            )
          })}

          <path
            d={line}
            fill="none"
            stroke="var(--color-ink-muted)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            pointerEvents="none"
          />
          {data.map((d, i) => (
            <circle
              key={d.date}
              cx={bandX(i)}
              cy={y(d.expected)}
              r={index === i ? 4.5 : 0}
              fill="var(--color-ink-muted)"
              stroke="var(--color-surface)"
              strokeWidth={2}
              pointerEvents="none"
            />
          ))}

          {/* Trait de rappel vers le jour annoté */}
          <line
            x1={annX}
            x2={annX}
            y1={44}
            y2={Math.min(y(weak.kwh), y(weak.expected)) - 6}
            stroke="var(--color-ink)"
            strokeWidth={1}
            pointerEvents="none"
          />
          <circle
            cx={annX}
            cy={Math.min(y(weak.kwh), y(weak.expected)) - 6}
            r={2.5}
            fill="var(--color-ink)"
            pointerEvents="none"
          />
        </svg>

        <div
          className={cx(
            'pointer-events-none absolute top-0 flex items-start gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs leading-snug font-medium text-ink',
            weakOk ? 'border-line bg-surface' : 'border-warning/50 bg-warning/10'
          )}
          style={{ left: annLeft, width: annW }}
          aria-hidden
        >
          {weakOk ? (
            <CloudIcon />
          ) : (
            <span className="mt-1 size-2 shrink-0 rounded-full bg-warning" />
          )}
          <span>
            {fmtDate(weak.date)} · {weakOk ? l.cloudy : l.check}
          </span>
        </div>

        <ChartTooltip
          show={index !== null}
          x={index !== null ? bandX(index) : 0}
          y={
            index !== null
              ? Math.max(48, y(Math.max(data[index].kwh, data[index].expected)) - 78)
              : 0
          }
          width={width}
        >
          {index !== null && data[index] && (
            <>
              <p className="mb-1 font-medium text-ink">
                {fmtDate(data[index].date, { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <TipRow
                color="var(--color-solar)"
                value={fmtKwh(data[index].kwh, 1)}
                label="produits"
              />
              <TipRow
                color="var(--color-ink-muted)"
                value={fmtKwh(data[index].expected, 1)}
                label="attendus"
              />
              <p className="mt-1 text-ink-muted">
                {fmtNum(data[index].sunHours, 1)} h de soleil ·{' '}
                {fmtNum((data[index].kwh / Math.max(0.01, data[index].expected)) * 100)} % de
                l’attendu
              </p>
            </>
          )}
        </ChartTooltip>
      </div>

      <DataTable
        caption="Production et ensoleillement par jour"
        head={['Jour', 'Produit', 'Attendu', 'Soleil']}
        rows={data.map((d) => [
          fmtDate(d.date, { day: 'numeric', month: 'short' }),
          fmtKwh(d.kwh, 1),
          fmtKwh(d.expected, 1),
          `${fmtNum(d.sunHours, 1)} h`,
        ])}
      />
    </div>
  )
}

/** Barre à extrémité arrondie (4 px), base carrée posée sur l'axe. */
function barPath(x: number, base: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h)
  const top = base - h
  return `M${x} ${base} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + w - r} Q${x + w} ${top} ${x + w} ${top + r} V${base} Z`
}

function CloudIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="mt-px size-3.5 shrink-0"
      fill="none"
      stroke="var(--color-ink-muted)"
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      <path d="M4.5 12.5h7a3 3 0 0 0 .4-6A4 4 0 0 0 4.3 7 2.8 2.8 0 0 0 4.5 12.5Z" />
    </svg>
  )
}
