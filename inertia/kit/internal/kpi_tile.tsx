import { motion, useReducedMotion } from 'motion/react'
import { useId } from 'react'
import { AnimatedNumber } from '../components/animated_number'
import { Term } from '../components/explain'
import { SkeletonStat } from '../components/skeleton'
import { duration, ease } from '../motion'
import { cx } from '../utils'
import { fmtSignedPct, scaleLinear } from './chart_utils'

/**
 * Mini-courbe de tendance (12 points conseillés) : ligne en gris de contexte, point courant en couleur primaire.
 * Friction traitée : un chiffre seul ne dit pas s'il monte ou s'il descend.
 */
export function OpsSparkline({
  values,
  width = 96,
  height = 28,
  label,
  className,
  tone = 'primary',
}: {
  values: number[]
  width?: number
  height?: number
  /** Résumé lu par les lecteurs d'écran. Sans label, la sparkline est décorative. */
  label?: string
  className?: string
  tone?: 'primary' | 'success' | 'danger' | 'warning'
}) {
  const reduce = useReducedMotion()
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const x = scaleLinear(0, values.length - 1, 3, width - 4)
  const y = scaleLinear(min, max, height - 4, 4)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const lx = x(values.length - 1)
  const ly = y(values[values.length - 1]!)
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cx('shrink-0 overflow-visible', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <motion.path
        key={d}
        d={d}
        fill="none"
        stroke="var(--color-ink-muted)"
        strokeOpacity={0.55}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: duration.story, ease: ease.out }}
      />
      <circle
        cx={lx}
        cy={ly}
        r={4}
        fill={`var(--color-${tone})`}
        stroke="var(--color-surface)"
        strokeWidth={2}
      />
    </svg>
  )
}

export type GoodDirection = 'up' | 'down' | 'neutral'

/**
 * Tuile KPI : libellé avec définition au survol, valeur animée, delta coloré selon le sens souhaité, sparkline.
 * Friction traitée : un KPI sans comparaison ni définition est soit ignoré, soit mal interprété (une hausse du churn n'est pas une bonne nouvelle).
 */
export function KpiTile({
  label,
  definition,
  value,
  previous,
  decimals = 0,
  prefix,
  suffix,
  spark,
  goodDirection = 'up',
  deltaMode = 'percent',
  comparisonLabel = 'vs période précédente',
  loading,
  className,
}: {
  label: string
  /** Définition du KPI (formule, périmètre) affichée au survol / focus du libellé. */
  definition?: string
  value: number
  previous?: number
  decimals?: number
  prefix?: string
  suffix?: string
  spark?: number[]
  /** Sens dans lequel une variation est une bonne nouvelle. `neutral` = toujours gris. */
  goodDirection?: GoodDirection
  /** `percent` = variation relative ; `points` = différence absolue en points (pour les taux). */
  deltaMode?: 'percent' | 'points'
  comparisonLabel?: string
  loading?: boolean
  className?: string
}) {
  const id = useId()
  if (loading) return <SkeletonStat className={className} />
  const hasPrev = previous !== undefined && previous !== 0
  const delta = hasPrev
    ? deltaMode === 'points'
      ? value - previous!
      : ((value - previous!) / Math.abs(previous!)) * 100
    : 0
  const flat = Math.abs(delta) < (deltaMode === 'points' ? 0.05 : 0.1)
  const good = goodDirection === 'neutral' || flat ? null : delta > 0 === (goodDirection === 'up')
  const tone = good === null ? 'text-ink-muted' : good ? 'text-success' : 'text-danger'
  const deltaText = flat
    ? deltaMode === 'points'
      ? '0,0 pt'
      : '0,0 %'
    : deltaMode === 'points'
      ? `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta).toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} pt`
      : fmtSignedPct(delta)
  const verdict = good === null ? 'stable' : good ? 'bonne tendance' : 'tendance défavorable'

  return (
    <div
      className={cx(
        'flex h-full min-w-0 flex-col rounded-md border border-line bg-surface p-4 shadow-card',
        className
      )}
    >
      {/* pas de `truncate` ici : overflow:hidden couperait l'info-bulle de définition (Term) */}
      <p className="text-sm leading-snug text-ink-muted [overflow-wrap:anywhere]">
        {definition ? <Term def={definition}>{label}</Term> : label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="min-w-0 font-display text-[1.75rem] leading-none font-semibold tracking-[-0.02em] text-ink [font-variant-numeric:normal]">
          <AnimatedNumber
            value={value}
            decimals={decimals}
            prefix={prefix}
            suffix={suffix}
            className="[font-variant-numeric:normal]"
          />
        </p>
        {spark && <OpsSparkline values={spark} tone={good === false ? 'danger' : 'primary'} />}
      </div>
      {hasPrev && (
        <p id={id} className="mt-3 flex flex-wrap items-center gap-x-1.5 text-xs">
          <span className={cx('inline-flex items-center gap-0.5 font-semibold tabular-nums', tone)}>
            <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
              {flat ? (
                <path d="M1.5 5h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path
                  d={delta > 0 ? 'M5 1.5v7M2 4.5l3-3 3 3' : 'M5 8.5v-7M2 5.5l3 3 3-3'}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
            {deltaText}
          </span>
          <span className="text-ink-muted">{comparisonLabel}</span>
          <span className="sr-only">({verdict})</span>
        </p>
      )}
    </div>
  )
}
