import { motion, useReducedMotion } from 'motion/react'
import { duration, ease } from '../motion'
import { cx } from '../utils'
import { fmtInt, fmtPct } from './chart_utils'

export type FunnelStep = { label: string; value: number; hint?: string }

/**
 * Entonnoir de conversion : volume par étape, taux de passage entre étapes, plus grosse perte mise en évidence.
 * Friction traitée : on optimise souvent l'étape la plus visible plutôt que celle qui fuit le plus.
 * La perte de chaque étape est dessinée (segment estompé) ; la plus forte passe en couleur « danger », avec libellé.
 */
export function FunnelChart({
  steps,
  format = fmtInt,
  biggestLossLabel = 'Plus grosse perte',
  overallLabel = 'Conversion globale',
  ariaLabel,
  pending,
  onStepClick,
  className,
}: {
  steps: FunnelStep[]
  format?: (v: number) => string
  biggestLossLabel?: string
  overallLabel?: string
  ariaLabel?: string
  pending?: boolean
  onStepClick?: (index: number) => void
  className?: string
}) {
  const reduce = useReducedMotion()
  const top = steps[0]?.value || 1
  const conv = steps.map((s, i) =>
    i === 0 ? 1 : steps[i - 1].value ? s.value / steps[i - 1].value : 0
  )
  let worst = 1
  conv.forEach((c, i) => {
    if (i > 0 && c < conv[worst]) worst = i
  })
  const overall = (steps[steps.length - 1]!.value / top) * 100
  const auto = `Entonnoir en ${steps.length} étapes, de ${format(top)} (${steps[0].label}) à ${format(steps[steps.length - 1]!.value)} (${steps[steps.length - 1]!.label}), conversion globale ${fmtPct(overall)}. ${biggestLossLabel} : ${steps[worst - 1].label} vers ${steps[worst].label}, ${fmtPct((1 - conv[worst]) * 100, 0)} perdus.`

  return (
    <figure
      className={cx('min-w-0 transition-opacity', pending && 'opacity-50', className)}
      role="group"
      aria-label={ariaLabel ?? auto}
    >
      <p className="mb-3 text-sm text-ink-muted">
        {overallLabel}{' '}
        <span className="font-semibold text-ink tabular-nums">{fmtPct(overall, 2)}</span>
      </p>
      <ol>
        {steps.map((s, i) => {
          const w = (s.value / top) * 100
          const prevW = i > 0 ? (steps[i - 1].value / top) * 100 : w
          const isWorst = i === worst
          const row = (
            <>
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-ink">
                  <span className="mr-2 text-xs text-ink-muted tabular-nums">{i + 1}</span>
                  {s.label}
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold text-ink">{format(s.value)}</span>
                  <span className="ml-2 inline-block w-12 text-right text-xs text-ink-muted">
                    {fmtPct(w, w < 10 ? 1 : 0)}
                  </span>
                </span>
              </span>
              <span
                className="relative mt-1.5 block h-3 overflow-hidden rounded-r-[4px]"
                style={{
                  background:
                    'color-mix(in oklab, var(--color-ink-muted) 10%, var(--color-surface))',
                }}
              >
                {i > 0 && (
                  <span
                    className="absolute inset-y-0 left-0 block rounded-r-[4px]"
                    // Segment « perdu » : ≥ 3:1 contre la piste ET contre la barre primaire (calcul sur tokens.css).
                    style={{
                      width: `${prevW}%`,
                      background: isWorst
                        ? 'color-mix(in oklab, var(--color-danger) 80%, var(--color-surface))'
                        : 'color-mix(in oklab, var(--color-ink-muted) 80%, var(--color-surface))',
                    }}
                    aria-hidden
                  />
                )}
                <motion.span
                  className="absolute inset-y-0 left-0 block rounded-r-[4px] bg-primary"
                  initial={reduce ? false : { width: '0%' }}
                  animate={{ width: `${Math.max(0.6, w)}%` }}
                  transition={{
                    duration: duration.slow,
                    ease: ease.out,
                    delay: reduce ? 0 : i * 0.05,
                  }}
                />
              </span>
            </>
          )
          return (
            <li key={s.label}>
              {i > 0 && (
                <div
                  className={cx(
                    'my-1 flex items-center gap-2 pl-5 text-xs tabular-nums',
                    isWorst ? 'font-medium text-danger' : 'text-ink-muted'
                  )}
                >
                  <svg viewBox="0 0 10 12" className="size-3 shrink-0" aria-hidden>
                    <path
                      d="M5 1v9M2 7l3 3 3-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>
                    {fmtPct(conv[i] * 100, conv[i] < 0.1 ? 1 : 0)} passent ·{' '}
                    {format(steps[i - 1].value - s.value)} perdus
                  </span>
                  {isWorst && (
                    <span className="rounded-full border border-danger/40 px-2 py-0.5 text-[11px] font-semibold">
                      {biggestLossLabel}
                    </span>
                  )}
                </div>
              )}
              {onStepClick ? (
                <button
                  type="button"
                  title={s.hint}
                  onClick={() => onStepClick(i)}
                  className="block w-full rounded-sm px-1 py-1 text-left hover:bg-surface-2/60 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {row}
                </button>
              ) : (
                <div title={s.hint} className="px-1 py-1">
                  {row}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </figure>
  )
}
