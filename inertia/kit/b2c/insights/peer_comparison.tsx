import { motion, useInView, useReducedMotion } from 'motion/react'
import { useRef } from 'react'
import { AnimatedNumber } from '../../components/animated_number'
import { Term, WhyThis } from '../../components/explain'
import { duration, ease } from '../../motion'
import { cx } from '../../utils'
import { fmtNum, fmtPct } from './shared'

const DEFAULT_LABELS = {
  metric: "taux d'autoconsommation",
  metricDef:
    'Part de votre production solaire utilisée par la maison (en direct ou via votre batterie virtuelle) plutôt que vendue au réseau. On compare la performance de votre installation, pas votre consommation.',
  you: 'Vous',
  peers: 'Foyers similaires',
  top: 'Les plus efficaces',
  topDef: 'Les 20 % de foyers comparables qui autoconsomment le plus.',
}

/**
 * Comparaison sociale positive : votre taux d'autoconsommation vs les foyers mylight150 de même puissance dans votre région
 * et vs les plus efficaces. Message toujours encourageant, y compris au-dessus de la moyenne (pas d'effet boomerang),
 * avec un pas concret vers le palier suivant.
 *
 * Friction traitée : la comparaison « vous consommez plus que vos voisins » culpabilise ; ici on compare une performance solaire, et chacun a un prochain pas.
 * Pattern : P6 (Opower, comparaison aux voisins efficaces)
 */
export function PeerComparison({
  you = 71,
  peers = 58,
  top = 79,
  percentile = 72,
  peerCount = 412,
  powerRange = '5 à 7 kWc',
  region = 'Rhône',
  period = 'septembre',
  nextStep = { text: 'Lancer le lave-linge entre 12 h et 15 h plutôt que le soir', gainPts: 4 },
  labels,
  className,
}: {
  /** Votre taux d'autoconsommation (%). */
  you?: number
  /** Moyenne des foyers comparables (%). */
  peers?: number
  /** Seuil des 20 % les plus efficaces (%). */
  top?: number
  /** Part des foyers comparables que vous dépassez (%). */
  percentile?: number
  peerCount?: number
  powerRange?: string
  region?: string
  period?: string
  /** Prochain pas suggéré et gain estimé en points. */
  nextStep?: { text: string; gainPts: number }
  labels?: Partial<typeof DEFAULT_LABELS>
  className?: string
}) {
  const l = { ...DEFAULT_LABELS, ...labels }
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()

  const tier = you >= top ? 'top' : you >= peers ? 'above' : 'below'
  const headline =
    tier === 'top'
      ? 'Vous faites partie des plus efficaces. Bravo.'
      : tier === 'above'
        ? `Mieux que ${Math.round(percentile / 10)} foyers sur 10 comparables.`
        : 'Votre installation a encore de la marge, et c’est une bonne nouvelle.'
  const sub =
    tier === 'top'
      ? 'Votre pilotage fait référence : gardez le cap cet hiver, quand le soleil se fait rare.'
      : tier === 'above'
        ? `Encore ${fmtNum(Math.max(0, top - you))} points pour rejoindre les plus efficaces.`
        : `Les foyers similaires sont à ${fmtPct(peers)} : chaque usage décalé vers midi vous en rapproche.`

  const rows = [
    { key: 'you', label: l.you, v: you, bar: 'bg-solar', strong: true },
    { key: 'peers', label: l.peers, v: peers, bar: 'bg-ink-muted/35' },
    { key: 'top', label: l.top, v: top, bar: 'bg-ink-muted/60', def: l.topDef },
  ]

  return (
    <div ref={ref} className={cx('flex flex-col gap-4', className)}>
      <div>
        <p className="font-display text-xl leading-snug font-semibold tracking-[-0.01em]">
          {headline}
        </p>
        <p className="mt-1 text-sm text-ink-muted">{sub}</p>
      </div>

      <div
        role="img"
        aria-label={`Votre ${l.metric} : ${fmtPct(you)}. Foyers similaires : ${fmtPct(peers)}. Les plus efficaces : ${fmtPct(top)}.`}
        className="space-y-3"
      >
        {rows.map((r, i) => (
          <div
            key={r.key}
            className="grid grid-cols-[7.5rem_1fr] items-center gap-3 sm:grid-cols-[9rem_1fr]"
          >
            <span
              className={cx('text-sm', r.strong ? 'font-semibold text-ink' : 'text-ink-muted')}
              aria-hidden
            >
              {r.label}
            </span>
            <div className="flex items-center gap-2" aria-hidden>
              <div className="relative h-3 flex-1 rounded-full bg-surface-2">
                <motion.div
                  className={cx('absolute inset-y-0 left-0 rounded-full', r.bar)}
                  initial={{ width: 0 }}
                  animate={{ width: inView ? `${Math.min(100, r.v)}%` : 0 }}
                  transition={{
                    duration: reduce ? 0 : duration.story,
                    delay: reduce ? 0 : i * 0.08,
                    ease: ease.out,
                  }}
                />
              </div>
              <span
                className={cx(
                  'w-11 text-right text-sm tabular-nums',
                  r.strong ? 'font-semibold text-ink' : 'text-ink-muted'
                )}
              >
                <AnimatedNumber value={r.v} suffix=" %" />
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-muted">
        Comparé : votre <Term def={l.metricDef}>{l.metric}</Term> en {period}, face à{' '}
        {fmtNum(peerCount)} foyers mylight150 de {powerRange} dans le {region}.{' '}
        <Term def={l.topDef}>Les plus efficaces</Term> = le top 20 %.
      </p>

      {nextStep && tier !== 'top' && (
        <div className="flex items-start gap-3 rounded-md border border-line bg-surface p-4">
          <span
            className="grid size-7 shrink-0 place-items-center rounded-full bg-solar/20 text-xs font-semibold text-ink"
            aria-hidden
          >
            +{nextStep.gainPts}
          </span>
          <p className="text-sm text-ink">
            <span className="font-semibold">Votre prochain pas : </span>
            {nextStep.text}, soit environ +{nextStep.gainPts} points.
          </p>
        </div>
      )}

      <WhyThis
        hypotheses={[
          { label: 'Foyers comparés', value: `${fmtNum(peerCount)} · ${powerRange} · ${region}` },
          { label: 'Mesure', value: 'kWh autoconsommés / kWh produits' },
          { label: 'Vous dépassez', value: `${fmtPct(percentile)} des foyers` },
        ]}
        source="On compare la performance solaire, pas la quantité consommée : personne n'est jugé sur sa facture."
      />
    </div>
  )
}
