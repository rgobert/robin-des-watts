import { Lock } from 'lucide-react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { softSpring, spring } from '../../motion'
import { cx } from '../../utils'

export type Trophy = {
  id: string
  icon: ReactNode
  title: string
  /** Le chiffre réel qui a débloqué le trophée. */
  value: string
  unlocked: boolean
  /** 0-1, pour un trophée verrouillé : distance au déblocage (gradient d'objectif). */
  progress?: number
  /** Trophée verrouillé : ce qu'il faut faire, ex. un lien vers l'écran suivant. */
  cta?: ReactNode
}

/**
 * Vitrine de trophées de l'année : chaque trophée débloqué est adossé à un vrai chiffre (pas de badge
 * gratuit), un seul trophée reste verrouillé et pointe vers l'action suivante.
 * Friction traitée : des chiffres empilés ne donnent pas de sentiment d'accomplissement ; une collection
 * presque complète donne envie de la finir (effet Zeigarnik), sans classement ni comparaison sociale.
 * L'ordre suit la lecture choisie : les trophées réordonnés glissent à leur place (`layout`).
 */
export function TrophyShelf({ trophies, className }: { trophies: Trophy[]; className?: string }) {
  const ref = useRef<HTMLUListElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const reduce = useReducedMotion() ?? false
  const unlocked = trophies.filter((t) => t.unlocked).length

  return (
    <div className={cx('flex flex-col gap-3', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink tabular-nums">
            {unlocked} / {trophies.length}
          </span>{' '}
          trophées débloqués
        </p>
        <div aria-hidden className="flex gap-1">
          {trophies.map((t) => (
            <span
              key={t.id}
              className={cx('h-1.5 w-4 rounded-full', t.unlocked ? 'bg-solar' : 'bg-gauge-track')}
            />
          ))}
        </div>
      </div>

      <ul ref={ref} className="grid grid-cols-3 gap-2">
        {trophies.map((t, i) => (
          <motion.li
            key={t.id}
            layout={!reduce}
            transition={spring}
            initial={reduce ? false : { opacity: 0, scale: 0.85, y: 6 }}
            animate={inView ? { opacity: 1, scale: 1, y: 0 } : undefined}
            className={cx(
              'flex flex-col items-center gap-1.5 rounded-lg px-2 py-3 text-center',
              t.unlocked
                ? 'bg-surface shadow-card'
                : 'col-span-3 border border-dashed border-line bg-canvas'
            )}
          >
            <motion.span
              aria-hidden
              initial={reduce ? false : { rotate: -25, scale: 0.6 }}
              animate={inView ? { rotate: 0, scale: 1 } : undefined}
              transition={{ ...softSpring, delay: reduce ? 0 : 0.15 + i * 0.08 }}
              className={cx(
                'grid size-12 place-items-center rounded-full',
                t.unlocked
                  ? 'bg-[radial-gradient(circle_at_30%_30%,var(--color-sun-glow),transparent_70%)] text-solar ring-2 ring-sun/40'
                  : 'bg-gauge-track text-ink-muted'
              )}
            >
              {t.unlocked ? t.icon : <Lock className="size-5" />}
            </motion.span>
            <span className="text-sm leading-tight font-semibold">{t.title}</span>
            <span className={cx('text-xs', t.unlocked ? 'text-ink-muted' : 'text-ink')}>
              {t.value}
            </span>
            {!t.unlocked && t.progress !== undefined && (
              <span
                aria-hidden
                className="mt-1 h-1.5 w-full max-w-56 overflow-hidden rounded-full bg-gauge-track"
              >
                <motion.span
                  className="block h-full origin-left rounded-full bg-hike"
                  initial={{ scaleX: 0 }}
                  animate={inView ? { scaleX: Math.max(0.04, t.progress) } : undefined}
                  transition={{ duration: 0.7, delay: reduce ? 0 : 0.6 }}
                />
              </span>
            )}
            {!t.unlocked && t.cta}
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
