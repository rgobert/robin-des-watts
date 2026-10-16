import { motion } from 'motion/react'
import { duration, ease } from '../../motion'
import { cx } from '../../utils'

const BADGE_LABELS = {
  /** Ce qui est chauffé / rechargé : « Eau chaude », « Voiture »… */
  subject: 'Eau chaude',
  when: "aujourd'hui",
  full: (s: string, w: string) => `${s} 100 % solaire ${w}`,
  partial: (s: string, p: number, w: string) => `${s} ${p} % solaire ${w}`,
  low: (s: string, p: number, w: string) => `${s} ${p} % solaire ${w}`,
  fullHint: 'Aucun kWh acheté pour ce poste.',
  partialHint: 'Le reste vient de votre batterie virtuelle.',
  lowHint: 'Journée grise : Robin a complété pour garder l’eau à 50 °C.',
}

/**
 * Badge de fierté « Eau chaude 100 % solaire aujourd'hui », avec ses états < 100 % (partiel, journée grise).
 * Mini-jauge circulaire en couleur solaire, texte toujours en encre (lisible).
 *
 * Friction traitée : le pilotage du chauffe-eau est invisible ; une contrainte technique devient une fierté quotidienne.
 * Pattern : P5 (myenergi zappi, pourcentage vert de la charge)
 */
export function SolarShareBadge({
  share,
  labels,
  size = 'md',
  className,
}: {
  /** Part solaire du poste, 0-100. */
  share: number
  labels?: Partial<typeof BADGE_LABELS>
  size?: 'sm' | 'md'
  className?: string
}) {
  const l = { ...BADGE_LABELS, ...labels }
  const p = Math.round(Math.max(0, Math.min(100, share)))
  const state = p >= 100 ? 'full' : p >= 50 ? 'partial' : 'low'
  const text =
    state === 'full'
      ? l.full(l.subject, l.when)
      : state === 'partial'
        ? l.partial(l.subject, p, l.when)
        : l.low(l.subject, p, l.when)
  const hint = state === 'full' ? l.fullHint : state === 'partial' ? l.partialHint : l.lowHint
  const r = 9
  const c = 2 * Math.PI * r
  return (
    <div
      role="status"
      aria-label={`${text}. ${hint}`}
      className={cx(
        'inline-flex max-w-full items-center gap-2.5 rounded-full border py-1.5 pr-4 pl-1.5',
        state === 'full'
          ? 'border-solar/50 bg-solar/15'
          : state === 'partial'
            ? 'border-solar/30 bg-solar/8'
            : 'border-line bg-surface-2',
        className
      )}
    >
      <span
        className={cx(
          'relative grid shrink-0 place-items-center',
          size === 'sm' ? 'size-6' : 'size-8'
        )}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="size-full -rotate-90">
          <circle cx="12" cy="12" r={r} fill="none" stroke="var(--color-line)" strokeWidth="3" />
          <motion.circle
            cx="12"
            cy="12"
            r={r}
            fill="none"
            stroke="var(--color-solar)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={c}
            initial={false}
            animate={{ strokeDashoffset: c * (1 - p / 100) }}
            transition={{ duration: duration.slow, ease: ease.out }}
          />
        </svg>
        {state === 'full' && (
          <svg viewBox="0 0 16 16" className="absolute size-3.5 text-ink">
            <circle cx="8" cy="8" r="3" fill="var(--color-solar)" />
            {Array.from({ length: 6 }, (_, i) => (
              <line
                key={i}
                x1="8"
                y1="1.5"
                x2="8"
                y2="3.2"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                transform={`rotate(${i * 60} 8 8)`}
              />
            ))}
          </svg>
        )}
      </span>
      <span className="min-w-0">
        <span className={cx('block font-semibold text-ink', size === 'sm' ? 'text-xs' : 'text-sm')}>
          {text}
        </span>
        {size === 'md' && <span className="block text-xs text-ink-muted">{hint}</span>}
      </span>
    </div>
  )
}
