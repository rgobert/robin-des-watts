import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { ActionButton } from '../../components/action_button'
import { AnimatedNumber } from '../../components/animated_number'
import { WhyThis } from '../../components/explain'
import { useToast } from '../../components/toast'
import { duration, ease } from '../../motion'
import { cx } from '../../utils'
import { StatusPill, fmtDay, fmtDuration, fmtEur, fmtNum, fmtTime, useClock } from './shared'

export type BonusHoursRecap = {
  /** kWh consommés pendant la fenêtre (comptés double). */
  kwh: number
  /** Bonus réellement crédité dans la cagnotte (€). */
  bonusEur: number
  /** Équipement qui a le plus absorbé. */
  topAppliance?: string
  /** Nombre de foyers mylight150 participants (sens épique). */
  participants?: number
}

type Labels = {
  badge: string
  title: string
  enroll: string
  enrolled: string
  unenroll: string
  startsIn: string
  live: string
  done: string
  robin: string
  noPenalty: string
}
const DEFAULT_LABELS: Labels = {
  badge: 'Heures soleil bonus',
  title: 'Vos kWh comptent double dans la cagnotte',
  enroll: 'Je participe',
  enrolled: 'Inscrit',
  unenroll: 'Me désinscrire',
  startsIn: 'Début dans',
  live: 'En cours',
  done: 'Terminé',
  robin:
    'Robin lance le ballon, la PAC et la voiture pendant la fenêtre. Vous pouvez aussi y glisser une lessive.',
  noPenalty: 'Sans pénalité : si vous ne participez pas, votre cagnotte habituelle ne change pas.',
}

/**
 * Événement « Heures soleil bonus » : une fenêtre réelle de prix négatifs pendant laquelle chaque kWh
 * consommé compte double dans la cagnotte. Inscription en 1 clic, compte à rebours jusqu'au début réel
 * (sans secondes, sans fausse urgence), suivi pendant, bilan après.
 * Friction traitée : tous les défis observés en France sont hivernaux et demandent de se priver ;
 * le producteur solaire n'a aucune raison de revenir l'été, quand il a le plus à gagner (white space n°2).
 * Pattern : P10 (Octopus Power Ups, Saving Sessions).
 */
export function BonusHoursEvent({
  start = new Date(2026, 9, 15, 11, 0),
  end = new Date(2026, 9, 15, 15, 0),
  now,
  dayLabel,
  multiplier = 2,
  reason = 'Prix négatifs prévus sur le marché de gros (EPEX Spot, J-1) : le réseau a trop d’électricité verte.',
  estimatedKwh = 14,
  ratePerKwh = 0.05,
  liveKwh = 6.2,
  recap = { kwh: 15.8, bonusEur: 0.79, topAppliance: 'la voiture (9,1 kWh)', participants: 8420 },
  enrolled: enrolledProp = false,
  onEnrollChange,
  labels: labelsProp,
  className,
}: {
  start?: Date
  end?: Date
  /** Heure de départ de l'horloge (démo). Par défaut : maintenant. L'horloge avance ensuite en temps réel. */
  now?: Date
  /** Libellé du jour (« jeudi 15 octobre »). Par défaut : déduit de `start`. */
  dayLabel?: string
  multiplier?: number
  /** Pourquoi l'événement existe (il doit être réel). */
  reason?: string
  /** kWh que Robin prévoit de placer dans la fenêtre. */
  estimatedKwh?: number
  /** Barème cagnotte habituel (€/kWh piloté). */
  ratePerKwh?: number
  /** kWh déjà comptés pendant l'événement en cours. */
  liveKwh?: number
  recap?: BonusHoursRecap
  enrolled?: boolean
  onEnrollChange?: (enrolled: boolean) => void
  labels?: Partial<Labels>
  className?: string
}) {
  const L = { ...DEFAULT_LABELS, ...labelsProp }
  const toast = useToast()
  const clock = useClock(now)
  const day = dayLabel ?? fmtDay(start)
  const [enrolled, setEnrolled] = useState(enrolledProp)
  const [btn, setBtn] = useState<'idle' | 'loading' | 'success'>('idle')

  const t = clock.getTime()
  const phase: 'upcoming' | 'live' | 'done' =
    t < start.getTime() ? 'upcoming' : t < end.getTime() ? 'live' : 'done'
  const extra = estimatedKwh * ratePerKwh * (multiplier - 1)
  const progress = Math.min(
    1,
    Math.max(0, (t - start.getTime()) / (end.getTime() - start.getTime()))
  )

  const setE = (v: boolean) => {
    setEnrolled(v)
    onEnrollChange?.(v)
  }
  const enroll = () => {
    setBtn('loading')
    setTimeout(() => {
      setBtn('success')
      setE(true)
      toast({
        message: `Inscrit. Robin s’occupe de tout ${day.split(' ')[0]} ${fmtTime(start)}-${fmtTime(end)}.`,
        tone: 'success',
        actionLabel: 'Annuler',
        onAction: () => {
          setE(false)
          setBtn('idle')
        },
      })
    }, 700)
  }
  const unenroll = () => {
    setE(false)
    setBtn('idle')
    toast({
      message: 'Désinscrit. Aucune pénalité, votre cagnotte habituelle continue.',
      actionLabel: 'Annuler',
      onAction: () => {
        setE(true)
        setBtn('success')
      },
    })
  }

  return (
    <div
      className={cx(
        'overflow-hidden rounded-lg border border-line bg-surface shadow-card',
        className
      )}
    >
      <div
        className="h-1.5 w-full"
        style={{ background: 'linear-gradient(90deg, var(--color-solar), var(--color-reward))' }}
        aria-hidden
      />
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink">
            <SunBadge /> {L.badge} · ×{multiplier}
          </span>
          {phase === 'upcoming' && (
            <StatusPill tone={enrolled ? 'success' : 'neutral'}>
              {enrolled ? L.enrolled : 'Inscription ouverte'}
            </StatusPill>
          )}
          {phase === 'live' && (
            <StatusPill tone="solar" pulse>
              {L.live}
            </StatusPill>
          )}
          {phase === 'done' && <StatusPill tone="reward">{L.done}</StatusPill>}
        </div>

        <h4 className="mt-3 font-display text-xl font-semibold tracking-[-0.01em] text-ink">
          {L.title}
        </h4>
        <p className="mt-1 text-sm text-ink-muted first-letter:uppercase">
          {day}, {fmtTime(start)}-{fmtTime(end)}
        </p>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: duration.base, ease: ease.out }}
            className="mt-4"
          >
            {phase === 'upcoming' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-surface-2 p-3">
                    <p className="text-xs text-ink/75">{L.startsIn}</p>
                    <p
                      className="mt-1 font-display text-2xl font-semibold text-ink"
                      aria-live="off"
                    >
                      {fmtDuration(start.getTime() - t)}
                    </p>
                  </div>
                  <div className="rounded-md bg-surface-2 p-3">
                    <p className="text-xs text-ink/75">Bonus estimé</p>
                    <p className="mt-1 font-display text-2xl font-semibold text-ink">
                      +{fmtEur(extra)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-ink">{L.robin}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {!enrolled ? (
                    <ActionButton
                      state={btn === 'success' ? 'idle' : btn}
                      loadingLabel="Inscription…"
                      onClick={enroll}
                    >
                      {L.enroll}
                    </ActionButton>
                  ) : (
                    <>
                      <ActionButton state="success" successLabel={L.enrolled} variant="primary">
                        {L.enrolled}
                      </ActionButton>
                      <button
                        type="button"
                        onClick={unenroll}
                        className="text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        {L.unenroll}
                      </button>
                    </>
                  )}
                </div>
                <p className="mt-3 text-xs text-ink-muted">{L.noPenalty}</p>
              </>
            )}

            {phase === 'live' && (
              <>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-ink-muted">
                    Fin à {fmtTime(end)} · encore {fmtDuration(end.getTime() - t)}
                  </span>
                  <span className="font-semibold tabular-nums text-ink">
                    {Math.round(progress * 100)} %
                  </span>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress * 100)}
                  aria-label="Avancement de l’événement"
                >
                  <motion.div
                    className="h-full rounded-full bg-solar"
                    initial={false}
                    animate={{ width: `${progress * 100}%` }}
                    transition={{ duration: duration.slow, ease: ease.out }}
                  />
                </div>
                {enrolled ? (
                  <p className="mt-4 text-sm text-ink">
                    Déjà <strong className="tabular-nums">{fmtNum(liveKwh, 1)} kWh</strong> comptés
                    double, soit{' '}
                    <strong className="tabular-nums">
                      +{fmtEur(liveKwh * ratePerKwh * multiplier)}
                    </strong>{' '}
                    dans la cagnotte.
                  </p>
                ) : (
                  <p className="mt-4 text-sm text-ink">
                    <strong className="tabular-nums">{fmtNum(liveKwh, 1)} kWh</strong> consommés
                    depuis {fmtTime(start)}, au barème habituel. Le reste de la fenêtre peut encore
                    compter double.
                  </p>
                )}
                {!enrolled && (
                  <ActionButton
                    className="mt-3"
                    variant="secondary"
                    onClick={() => {
                      setE(true)
                      toast({
                        message:
                          'Inscrit en cours de route : le reste de la fenêtre compte double.',
                        tone: 'success',
                      })
                    }}
                  >
                    Participer pour le reste de la fenêtre
                  </ActionButton>
                )}
              </>
            )}

            {phase === 'done' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-surface-2 p-3">
                    <p className="text-xs text-ink/75">kWh comptés double</p>
                    <p className="mt-1 font-display text-2xl font-semibold text-ink">
                      <AnimatedNumber value={recap.kwh} decimals={1} suffix=" kWh" />
                    </p>
                  </div>
                  <div className="rounded-md bg-surface-2 p-3">
                    <p className="text-xs text-ink/75">Bonus crédité</p>
                    <p className="mt-1 font-display text-2xl font-semibold text-ink">
                      <AnimatedNumber value={recap.bonusEur} decimals={2} prefix="+" suffix=" €" />
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-ink">
                  {recap.topAppliance && <>Champion du jour : {recap.topAppliance}. </>}
                  {recap.participants && (
                    <>
                      Avec vous, {fmtNum(recap.participants)} foyers mylight150 ont absorbé le
                      surplus du réseau.
                    </>
                  )}
                </p>
                <WhyThis
                  className="mt-3"
                  title="Comment est calculé le bonus ?"
                  hypotheses={[
                    { label: 'kWh pendant la fenêtre', value: `${fmtNum(recap.kwh, 1)} kWh` },
                    { label: 'Barème cagnotte', value: `${fmtNum(ratePerKwh * 100, 0)} cts/kWh` },
                    { label: 'Multiplicateur', value: `×${multiplier}` },
                    { label: 'Crédité', value: fmtEur(recap.bonusEur) },
                  ]}
                  source="Mesures de Robin au pas de 10 min. Bonus versé dans la cagnotte le lendemain."
                />
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
          Pourquoi cet événement : {reason}
        </p>
      </div>
    </div>
  )
}

function SunBadge() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
      <circle cx="8" cy="8" r="3.2" fill="var(--color-solar)" />
      <g stroke="var(--color-solar)" strokeWidth="1.4" strokeLinecap="round">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line key={a} x1="8" y1="1.5" x2="8" y2="3" transform={`rotate(${a} 8 8)`} />
        ))}
      </g>
    </svg>
  )
}
