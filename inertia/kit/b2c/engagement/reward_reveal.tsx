import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { AnimatedNumber } from '../../components/animated_number'
import { WhyThis } from '../../components/explain'
import { duration, ease, softSpring } from '../../motion'
import { cx } from '../../utils'
import { fmtEur } from './shared'

type Labels = {
  eyebrow: string
  hold: string
  holdHint: string
  skip: string
  revealedTitle: string
  honesty: string
}
const DEFAULT_LABELS: Labels = {
  eyebrow: 'Bonus du jour d’événement',
  hold: 'Maintenez pour découvrir',
  holdHint: 'Appui long, ou Espace maintenu au clavier',
  skip: 'Afficher directement',
  revealedTitle: 'Déjà dans votre cagnotte',
  honesty: 'Ce bonus est déjà gagné et crédité : vous ne misez rien, il n’y a rien à perdre.',
}

/**
 * Révélation tactile d'un bonus RÉEL déjà gagné un jour d'événement (pas un tirage : le montant est
 * fixé avant l'affichage, l'utilisateur ne mise rien). Appui long avec anneau qui se remplit,
 * alternative « Afficher directement » pour ne rien faire dépendre du geste.
 * Friction traitée : un crédit de cagnotte noyé dans un historique ne se remarque pas ; la révélation
 * crée un pic émotionnel (règle pic-fin) sans mécanique de jeu d'argent.
 * Pattern : P11 (Hello Watt, roulette ; adaptée en surprise déterministe).
 */
export function RewardReveal({
  amount = 0.79,
  eventLabel = 'Heures soleil bonus · jeudi 15 octobre',
  hypotheses = [
    { label: 'kWh pendant la fenêtre', value: '15,8 kWh' },
    { label: 'Barème habituel (5 cts/kWh)', value: '0,79 €' },
    { label: 'Bonus « compte double »', value: '+0,79 €' },
  ],
  holdMs = 900,
  revealed: revealedProp = false,
  onReveal,
  labels: labelsProp,
  className,
}: {
  /** Montant déjà crédité (€). */
  amount?: number
  eventLabel?: string
  hypotheses?: { label: string; value: string }[]
  /** Durée de l'appui long. */
  holdMs?: number
  revealed?: boolean
  onReveal?: () => void
  labels?: Partial<Labels>
  className?: string
}) {
  const L = { ...DEFAULT_LABELS, ...labelsProp }
  const reduce = useReducedMotion()
  const [revealed, setRevealed] = useState(revealedProp)
  const progress = useMotionValue(0)
  const dash = useTransform(progress, (p) => p)
  const scale = useTransform(progress, [0, 1], [1, 0.94])
  const anim = useRef<ReturnType<typeof animate> | null>(null)

  const reveal = () => {
    anim.current?.stop()
    setRevealed(true)
    onReveal?.()
  }
  const startHold = () => {
    if (revealed) return
    if (reduce) return reveal()
    anim.current?.stop()
    anim.current = animate(progress, 1, {
      duration: (holdMs / 1000) * (1 - progress.get()),
      ease: 'linear',
      onComplete: reveal,
    })
  }
  const cancelHold = () => {
    if (revealed) return
    anim.current?.stop()
    anim.current = animate(progress, 0, { duration: duration.fast, ease: ease.out })
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault()
      startHold()
    }
  }
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') cancelHold()
  }

  const R = 54
  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-lg border border-line bg-surface p-5 text-center shadow-card',
        className
      )}
    >
      <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{L.eyebrow}</p>
      <p className="mt-1 text-sm text-ink">{eventLabel}</p>

      <div className="relative mx-auto mt-4 grid size-36 place-items-center">
        <AnimatePresence mode="wait" initial={false}>
          {!revealed ? (
            <motion.button
              key="cover"
              type="button"
              aria-label={`${L.hold}. ${L.holdHint}.`}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                startHold()
              }}
              onPointerUp={cancelHold}
              onPointerCancel={cancelHold}
              onKeyDown={onKeyDown}
              onKeyUp={onKeyUp}
              onContextMenu={(e) => e.preventDefault()}
              style={{ scale }}
              exit={{
                scale: 1.15,
                opacity: 0,
                transition: { duration: duration.base, ease: ease.out },
              }}
              className="relative grid size-36 touch-none place-items-center rounded-full select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
                <circle
                  cx="60"
                  cy="60"
                  r={R}
                  fill="none"
                  stroke="var(--color-surface-2)"
                  strokeWidth="6"
                />
                <motion.circle
                  cx="60"
                  cy="60"
                  r={R}
                  fill="none"
                  stroke="var(--color-reward)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  style={{ pathLength: dash }}
                />
              </svg>
              <span
                className="grid size-28 place-items-center rounded-full text-primary-contrast"
                style={{
                  background:
                    'radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--color-solar) 85%, var(--color-surface)), color-mix(in oklab, var(--color-reward) 85%, var(--color-ink)))',
                }}
              >
                <span className="px-3 text-xs leading-tight font-semibold">{L.hold}</span>
              </span>
            </motion.button>
          ) : (
            <motion.div
              key="amount"
              initial={{ scale: reduce ? 1 : 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={softSpring}
              className="grid size-36 place-items-center rounded-full bg-surface-2"
              role="status"
            >
              <div>
                <p className="font-display text-4xl font-semibold text-ink">
                  <AnimatedNumber
                    value={amount}
                    decimals={2}
                    prefix="+"
                    suffix=" €"
                    duration={0.7}
                  />
                </p>
                <p className="mt-1 text-xs text-ink-muted">{L.revealedTitle}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {revealed && !reduce && <Burst />}
      </div>

      {!revealed ? (
        <div className="mt-3">
          <p className="text-xs text-ink-muted">{L.holdHint}</p>
          <button
            type="button"
            onClick={reveal}
            className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {L.skip}
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: duration.base, ease: ease.out }}
          className="mt-4 text-left"
        >
          <p className="text-sm text-ink">
            Vos kWh solaires ont compté double pendant l’événement :{' '}
            <strong>{fmtEur(amount)}</strong> de plus, versés avec la cagnotte du mois.
          </p>
          <WhyThis
            className="mt-3"
            hypotheses={hypotheses}
            source="Montant calculé à la fin de l’événement, avant la révélation."
          />
        </motion.div>
      )}
      <p className="mt-4 text-[11px] leading-snug text-ink-muted">{L.honesty}</p>
    </div>
  )
}

function Burst() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return (
          <motion.span
            key={i}
            className="absolute top-1/2 left-1/2 size-2 rounded-full"
            style={{ background: i % 3 === 0 ? 'var(--color-solar)' : 'var(--color-reward)' }}
            initial={{ x: -4, y: -4, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(a) * 92 - 4, y: Math.sin(a) * 92 - 4, opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.9, ease: ease.out, delay: 0.1 }}
          />
        )
      })}
    </div>
  )
}
