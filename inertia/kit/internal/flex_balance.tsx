import { motion, useReducedMotion } from 'motion/react'
import { AnimatedNumber } from '../components/animated_number'
import { Term } from '../components/explain'
import { duration, ease } from '../motion'
import { cx } from '../utils'
import { fmtEuroCompact, fmtPct, fmtSignedPct } from './chart_utils'
import { OpsSparkline } from './kpi_tile'

/**
 * Indicateur « € de cagnotte versés vs € de flexibilité captés » : deux barres sur la même échelle,
 * marge et taux de redistribution, variation vs période de comparaison.
 * Friction traitée : la cagnotte est vue comme un coût marketing, la flexibilité comme une ligne de trading ;
 * personne ne vérifie que la première reste financée par la seconde. Ici, les deux sont côte à côte.
 * Pattern : P20 (adaptation mylight150 du benchmark Stripe / Baremetrics).
 */
export function FlexBalance({
  captured,
  paid,
  prevCaptured,
  prevPaid,
  capturedSeries,
  paidSeries,
  capturedLabel = 'Flexibilité captée',
  paidLabel = 'Cagnotte versée',
  comparisonLabel = 'vs période préc.',
  pending,
  className,
}: {
  captured: number
  paid: number
  prevCaptured?: number
  prevPaid?: number
  capturedSeries?: number[]
  paidSeries?: number[]
  capturedLabel?: string
  paidLabel?: string
  comparisonLabel?: string
  pending?: boolean
  className?: string
}) {
  const reduce = useReducedMotion()
  const max = Math.max(captured, paid, 1)
  const margin = captured - paid
  const ratio = captured ? (paid / captured) * 100 : 0
  const prevRatio = prevCaptured ? ((prevPaid ?? 0) / prevCaptured) * 100 : undefined
  const rows = [
    {
      key: 'cap',
      label: capturedLabel,
      value: captured,
      prev: prevCaptured,
      color: 'var(--color-battery)',
      series: capturedSeries,
      def: 'Valeur créée par le pilotage Robin : arbitrage des prix spot, prix négatifs évités, rémunération de capacité.',
    },
    {
      key: 'paid',
      label: paidLabel,
      value: paid,
      prev: prevPaid,
      color: 'var(--color-reward)',
      series: paidSeries,
      def: 'Gains crédités aux clients : barème +5 cts par kWh piloté (chauffe-eau, pompe à chaleur, borne).',
    },
  ]
  const aria = `${capturedLabel} ${fmtEuroCompact(captured)}, ${paidLabel.toLowerCase()} ${fmtEuroCompact(paid)}, marge ${fmtEuroCompact(margin)}, ${fmtPct(ratio, 0)} de la valeur redistribuée aux clients.`

  return (
    <figure
      role="group"
      aria-label={aria}
      className={cx('min-w-0 transition-opacity', pending && 'opacity-50', className)}
    >
      <div className="space-y-4">
        {rows.map((r, i) => {
          const delta = r.prev ? ((r.value - r.prev) / r.prev) * 100 : undefined
          return (
            <div key={r.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="inline-flex min-w-0 items-center gap-2 text-sm text-ink">
                  <span
                    className="size-2.5 shrink-0 rounded-[3px]"
                    style={{ background: r.color }}
                    aria-hidden
                  />
                  <Term def={r.def}>{r.label}</Term>
                </span>
                <span className="shrink-0 text-right">
                  <span className="text-lg font-semibold text-ink">
                    <AnimatedNumber
                      value={Math.round(r.value / 1000)}
                      suffix=" k€"
                      className="[font-variant-numeric:normal]"
                    />
                  </span>
                  {delta !== undefined && (
                    <span className="ml-2 text-xs text-ink-muted tabular-nums">
                      {fmtSignedPct(delta)}
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-3 min-w-0 flex-1">
                  <motion.div
                    className="h-full rounded-r-[4px]"
                    style={{ background: r.color }}
                    initial={reduce ? false : { width: '0%' }}
                    animate={{ width: `${(r.value / max) * 100}%` }}
                    transition={{
                      duration: duration.slow,
                      ease: ease.out,
                      delay: reduce ? 0 : i * 0.06,
                    }}
                  />
                </div>
                {r.series && <OpsSparkline values={r.series} width={64} height={20} />}
              </div>
            </div>
          )
        })}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line text-sm">
        <div className="bg-surface px-3 py-2">
          <dt className="text-xs text-ink-muted">Marge de flexibilité</dt>
          <dd
            className={cx(
              'mt-0.5 font-semibold tabular-nums',
              margin >= 0 ? 'text-ink' : 'text-danger'
            )}
          >
            {fmtEuroCompact(margin)}
          </dd>
        </div>
        <div className="bg-surface px-3 py-2">
          <dt className="text-xs text-ink-muted">Redistribué aux clients</dt>
          <dd className="mt-0.5 font-semibold text-ink tabular-nums">
            {fmtPct(ratio, 0)}
            {prevRatio !== undefined && (
              <span className="ml-1.5 text-xs font-normal text-ink-muted">
                {comparisonLabel.replace(/^vs /, 'vs ')} {fmtPct(prevRatio, 0)}
              </span>
            )}
          </dd>
        </div>
      </dl>
      {margin < 0 && (
        <p className="mt-2 text-xs font-medium text-danger">
          La cagnotte dépasse la valeur captée : le barème n’est plus financé.
        </p>
      )}
    </figure>
  )
}
