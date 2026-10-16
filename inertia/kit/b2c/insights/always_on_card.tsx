import { motion, useReducedMotion } from 'motion/react'
import { useMemo, type PointerEvent } from 'react'
import { AnimatedNumber } from '../../components/animated_number'
import { Term, WhyThis } from '../../components/explain'
import { duration, ease } from '../../motion'
import { cx, formatEuro } from '../../utils'
import { ChartTooltip, TipRow, fmtNum, useArrowIndex, useElementWidth } from './shared'

/** Un point de la nuit : heure « HH:MM » et puissance moyenne appelée (W). */
export type NightPoint = { time: string; watts: number }

/* Nuit du mardi 13 au mercredi 14 octobre, pas de 15 min, 22:00 → 06:45. Frigo-congélateur qui cycle au-dessus d'un socle de ~145 W. */
const DEFAULT_NIGHT: NightPoint[] = (() => {
  const w = [
    420, 390, 360, 310, 260, 210, 190, 172, 158, 205, 150, 147, 210, 148, 146, 145, 202, 147, 145,
    149, 206, 146, 145, 148, 204, 150, 151, 170, 260, 380, 520, 610,
  ]
  return w.map((watts, i) => {
    const m = 22 * 60 + i * 15
    const h = Math.floor(m / 60) % 24
    return { time: `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, watts }
  })
})()

const DEFAULT_LABELS = {
  title: 'Consommation de fond la nuit',
  termDef:
    'Ce que la maison consomme en permanence, même quand tout le monde dort : box, frigo, veilles, VMC, appareils oubliés. Robin la mesure entre 1h et 5h.',
  perYear: 'par an',
  comparison: (peer: number) => `Les foyers comparables tournent autour de ${fmtNum(peer)} W.`,
  tipTitle: 'Votre prochaine action',
  tip: 'Branchez la box TV, la console et la barre de son sur une multiprise à interrupteur, éteinte la nuit.',
  tipGain: (w: number, eur: string) => `Jusqu'à −${fmtNum(w)} W, soit ${eur} par an.`,
  ctaLabel: 'Je le fais ce soir',
  chartLabel: 'Puissance appelée la nuit',
  baseLabel: 'socle',
}

/**
 * Socle « toujours allumé » : la puissance de fond de la nuit, traduite en €/an, avec la courbe nocturne
 * dont le socle est surligné et un conseil chiffré.
 *
 * Friction traitée : les veilles sont invisibles et « ça ne coûte rien » ; une découverte en euros pousse à agir le soir même.
 * Pattern : P2 (Sense « Always On », Ecojoko détection des veilles)
 */
export function AlwaysOnCard({
  night = DEFAULT_NIGHT,
  baseloadW,
  pricePerKwh = 0.1952,
  peerBaseloadW = 95,
  tipSavingW = 40,
  onCta,
  labels,
  className,
}: {
  night?: NightPoint[]
  /** Socle en W. Par défaut : 10ᵉ centile des points de la nuit (robuste aux cycles du frigo). */
  baseloadW?: number
  /** Prix du kWh acheté au réseau (€ TTC). */
  pricePerKwh?: number
  peerBaseloadW?: number
  /** Gain estimé du conseil, en W. */
  tipSavingW?: number
  onCta?: () => void
  labels?: Partial<typeof DEFAULT_LABELS>
  className?: string
}) {
  const l = { ...DEFAULT_LABELS, ...labels }
  const reduce = useReducedMotion()
  const base = useMemo(() => {
    if (baseloadW !== undefined) return baseloadW
    const sorted = night.map((p) => p.watts).sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length * 0.1)] ?? 0
  }, [night, baseloadW])
  const kwhYear = (base * 8760) / 1000
  const eurYear = kwhYear * pricePerKwh
  const tipEur = ((tipSavingW * 8760) / 1000) * pricePerKwh

  /* --- Graphique --- */
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(420)
  const H = 150
  const pad = { l: 8, r: 8, t: 14, b: 22 }
  const maxW = Math.max(...night.map((p) => p.watts), base) * 1.08
  const x = (i: number) => pad.l + (i / Math.max(1, night.length - 1)) * (width - pad.l - pad.r)
  const y = (w: number) => pad.t + (1 - w / maxW) * (H - pad.t - pad.b)
  const line = night
    .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.watts).toFixed(1)}`)
    .join(' ')
  const area = `${line} L${x(night.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`
  const baseY = y(base)
  const { index, setIndex, onKeyDown, onBlur } = useArrowIndex(night.length)
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const rel = (e.clientX - r.left - pad.l) / (r.width - pad.l - pad.r)
    setIndex(Math.max(0, Math.min(night.length - 1, Math.round(rel * (night.length - 1)))))
  }
  const ticks = night
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.time.endsWith(':00') && Number(p.time.slice(0, 2)) % 2 === 0)
  const minP = night.reduce((m, p) => (p.watts < m.watts ? p : m), night[0])
  const ariaChart = `${l.chartLabel} de ${night[0]?.time} à ${night[night.length - 1]?.time} : de ${fmtNum(minP?.watts ?? 0)} à ${fmtNum(
    Math.max(...night.map((p) => p.watts))
  )} W. Socle permanent ${fmtNum(base)} W, surligné. Flèches pour parcourir.`

  return (
    <div className={cx('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="text-sm text-ink-muted">
            <Term def={l.termDef}>{l.title}</Term>
          </p>
          <p className="mt-1 font-display text-4xl font-semibold tracking-[-0.03em]">
            <AnimatedNumber value={base} suffix=" W" />
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-semibold">
            <AnimatedNumber value={Math.round(eurYear)} suffix=" €" />
          </p>
          <p className="text-xs text-ink-muted">
            {l.perYear} · {fmtNum(kwhYear)} kWh
          </p>
        </div>
      </div>
      <p className="-mt-2 text-sm text-ink-muted">{l.comparison(peerBaseloadW)}</p>

      <div ref={wrapRef} className="relative">
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={ariaChart}
          tabIndex={0}
          onPointerMove={onMove}
          onPointerLeave={() => setIndex(null)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          className="block touch-pan-y rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
        >
          <line x1={pad.l} x2={width - pad.r} y1={y(0)} y2={y(0)} stroke="var(--color-line)" />
          <path d={area} fill="var(--color-home)" opacity={0.08} />
          {/* Socle surligné : bande pleine sous le seuil, sur toute la nuit */}
          <motion.rect
            x={pad.l}
            width={width - pad.l - pad.r}
            rx={2}
            fill="var(--color-home)"
            initial={{ opacity: 0, y: y(0), height: 0 }}
            animate={{ opacity: 0.22, y: baseY, height: y(0) - baseY }}
            transition={{ duration: reduce ? 0 : duration.story, ease: ease.out }}
          />
          <line
            x1={pad.l}
            x2={width - pad.r}
            y1={baseY}
            y2={baseY}
            stroke="var(--color-home)"
            strokeWidth={2}
          />
          <path
            d={line}
            fill="none"
            stroke="var(--color-home)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <text
            x={width / 2}
            y={Math.min(y(0) - 4, baseY + 13)}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill="var(--color-ink)"
            stroke="var(--color-surface)"
            strokeWidth={3}
            paintOrder="stroke"
          >
            {l.baseLabel} {fmtNum(base)} W
          </text>
          {ticks.map(({ p, i }) => (
            <text
              key={p.time}
              x={x(i)}
              y={H - 6}
              textAnchor={i === 0 ? 'start' : 'middle'}
              fontSize={10}
              fill="var(--color-ink-muted)"
            >
              {p.time.replace(':00', ' h')}
            </text>
          ))}
          {index !== null && night[index] && (
            <g pointerEvents="none">
              <line
                x1={x(index)}
                x2={x(index)}
                y1={pad.t - 6}
                y2={y(0)}
                stroke="var(--color-ink-muted)"
                strokeWidth={1}
              />
              <circle
                cx={x(index)}
                cy={y(night[index].watts)}
                r={4.5}
                fill="var(--color-home)"
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>
        <ChartTooltip show={index !== null} x={index !== null ? x(index) : 0} y={-6} width={width}>
          {index !== null && night[index] && (
            <>
              <TipRow
                color="var(--color-home)"
                value={`${fmtNum(night[index].watts)} W`}
                label={`à ${night[index].time}`}
              />
              <p className="mt-0.5 text-ink-muted">
                {night[index].watts - base > 30
                  ? `dont ${fmtNum(night[index].watts - base)} W au-dessus du socle`
                  : 'au niveau du socle'}
              </p>
            </>
          )}
        </ChartTooltip>
      </div>

      <div className="rounded-md border border-line bg-surface p-4">
        <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">{l.tipTitle}</p>
        <p className="mt-1 text-sm text-ink">{l.tip}</p>
        <p className="mt-1 text-sm font-semibold text-reward">
          {l.tipGain(tipSavingW, formatEuro(tipEur))}
        </p>
        {onCta && (
          <button
            type="button"
            onClick={onCta}
            className="mt-3 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-contrast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {l.ctaLabel}
          </button>
        )}
      </div>

      <WhyThis
        hypotheses={[
          { label: 'Socle mesuré (10ᵉ centile, 22 h-7 h)', value: `${fmtNum(base)} W` },
          { label: 'Heures dans une année', value: '8 760 h' },
          { label: 'Prix du kWh réseau', value: `${fmtNum(pricePerKwh, 4)} €` },
          { label: 'Coût annuel', value: formatEuro(eurYear) },
        ]}
        source="Hypothèse prudente : la nuit, ce socle est acheté au réseau (pas de soleil)."
      />
    </div>
  )
}
