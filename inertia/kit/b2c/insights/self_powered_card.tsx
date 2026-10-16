import { useState } from 'react'
import { AnimatedNumber } from '../../components/animated_number'
import { Term, WhyThis } from '../../components/explain'
import { GoalRing } from '../../components/goal_ring'
import { cx } from '../../utils'
import { Segmented, fmtKwh, fmtPct } from './shared'

export type SelfPoweredPeriod = 'day' | 'month' | 'year'

/** Bilan d'une période, en kWh : le pourcentage est calculé, jamais saisi à la main. */
export type SelfPoweredStats = {
  /** Consommation totale de la maison. */
  consumptionKwh: number
  /** Part de cette consommation couverte par le solaire (direct + restitué). */
  solarKwh: number
  /** Part du solaire qui n'aurait pas été consommée sans le pilotage de Robin. */
  robinKwh: number
}

const DEFAULT_DATA: Record<SelfPoweredPeriod, SelfPoweredStats> = {
  day: { consumptionKwh: 16.2, solarKwh: 11, robinKwh: 3.4 },
  month: { consumptionKwh: 248, solarKwh: 184, robinKwh: 45 },
  year: { consumptionKwh: 6420, solarKwh: 3920, robinKwh: 900 },
}

const DEFAULT_LABELS = {
  periodLabel: 'Période',
  periods: { day: "Aujourd'hui", month: 'Ce mois-ci', year: 'Cette année' } as Record<
    SelfPoweredPeriod,
    string
  >,
  /** Complément de phrase après « Votre maison est solaire à X % ». */
  phrase: { day: "aujourd'hui", month: 'ce mois-ci', year: 'cette année' } as Record<
    SelfPoweredPeriod,
    string
  >,
  hint: {
    day: 'Une seule journée dépend surtout de la météo.',
    month: 'Le mois en cours, jour après jour.',
    year: "L'année lisse les mois d'hiver : c'est le chiffre qui compte.",
  } as Record<SelfPoweredPeriod, string>,
  headlineStart: 'Votre maison est',
  term: 'solaire',
  termDef:
    "Part de l'électricité consommée par la maison qui vient de vos panneaux, en direct ou restituée par votre batterie virtuelle. 100 % = aucun kWh acheté au réseau.",
  robinPrefix: 'dont',
  robinSuffix: 'grâce à Robin',
  robinDef:
    'Les kWh solaires que vous auriez injectés sans pilotage : Robin a lancé le chauffe-eau, la PAC ou la voiture au bon moment.',
  ringOuter: 'Part solaire',
  ringInner: 'Part due à Robin',
}

/**
 * Carte héroïque « Votre maison est solaire à X % » avec sélecteur de période (année par défaut).
 * Anneau extérieur = part solaire de la consommation ; anneau intérieur = la part apportée par le pilotage de Robin.
 *
 * Friction traitée : des kWh produits / consommés qu'on ne sait pas relier ; un seul chiffre fier, et la valeur de Robin rendue visible.
 * Pattern : P1 (Tesla, onglet Impact « Self-Powered », vue annuelle par défaut)
 */
export function SelfPoweredCard({
  data = DEFAULT_DATA,
  defaultPeriod = 'year',
  period: controlled,
  onPeriodChange,
  labels,
  className,
}: {
  data?: Record<SelfPoweredPeriod, SelfPoweredStats>
  defaultPeriod?: SelfPoweredPeriod
  /** Mode contrôlé (optionnel). */
  period?: SelfPoweredPeriod
  onPeriodChange?: (p: SelfPoweredPeriod) => void
  labels?: Partial<typeof DEFAULT_LABELS>
  className?: string
}) {
  const l = { ...DEFAULT_LABELS, ...labels }
  const [inner, setInner] = useState<SelfPoweredPeriod>(defaultPeriod)
  const period = controlled ?? inner
  const setPeriod = (p: SelfPoweredPeriod) => {
    setInner(p)
    onPeriodChange?.(p)
  }
  const s = data[period]
  const pct = s.consumptionKwh > 0 ? Math.min(100, (s.solarKwh / s.consumptionKwh) * 100) : 0
  const robinPct = s.consumptionKwh > 0 ? Math.min(pct, (s.robinKwh / s.consumptionKwh) * 100) : 0
  const pctR = Math.round(pct)
  const robinR = Math.round(robinPct)
  const decimals = period === 'day' ? 1 : 0
  const robinColor = 'color-mix(in oklab, var(--color-solar) 55%, var(--color-ink))'

  return (
    <div className={cx('flex flex-col gap-5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">{l.hint[period]}</p>
        <Segmented
          label={l.periodLabel}
          value={period}
          onChange={setPeriod}
          options={(['day', 'month', 'year'] as const).map((k) => ({
            key: k,
            label: l.periods[k],
          }))}
        />
      </div>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <div
          role="img"
          aria-label={`${l.headlineStart} ${l.term} à ${pctR} % ${l.phrase[period]}, ${l.robinPrefix} ${robinR} % ${l.robinSuffix}.`}
          className="shrink-0"
        >
          <GoalRing value={pct} size={176} stroke={14} color="var(--color-solar)" celebrate={false}>
            <GoalRing value={robinPct} size={128} stroke={9} color={robinColor} celebrate={false}>
              <div aria-hidden>
                <p className="font-display text-4xl font-semibold tracking-[-0.03em]">
                  <AnimatedNumber value={pctR} suffix=" %" />
                </p>
                <p className="text-xs text-ink-muted">{l.ringOuter.toLowerCase()}</p>
              </div>
            </GoalRing>
          </GoalRing>
        </div>

        <div className="min-w-0 text-center sm:text-left">
          <p className="font-display text-2xl leading-tight tracking-[-0.02em] sm:text-[1.7rem]">
            {l.headlineStart} <Term def={l.termDef}>{l.term}</Term> à{' '}
            <span className="font-semibold">
              <AnimatedNumber value={pctR} suffix=" %" />
            </span>{' '}
            {l.phrase[period]}
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            {l.robinPrefix}{' '}
            <span className="font-semibold text-ink">
              <AnimatedNumber value={robinR} suffix=" %" />
            </span>{' '}
            <Term def={l.robinDef}>{l.robinSuffix}</Term>
          </p>
          <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-muted sm:justify-start">
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-solar" aria-hidden />
              {l.ringOuter}
            </li>
            <li className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: robinColor }}
                aria-hidden
              />
              {l.ringInner}
            </li>
          </ul>
        </div>
      </div>

      <WhyThis
        hypotheses={[
          { label: 'Consommation de la maison', value: fmtKwh(s.consumptionKwh, decimals) },
          {
            label: 'Couverte par le solaire',
            value: `${fmtKwh(s.solarKwh, decimals)} · ${fmtPct(pct)}`,
          },
          {
            label: 'Dont kWh décalés par Robin',
            value: `${fmtKwh(s.robinKwh, decimals)} · ${fmtPct(robinPct)}`,
          },
        ]}
        source="Mesures Robin, solaire direct + kWh restitués par la batterie virtuelle."
      />
    </div>
  )
}
