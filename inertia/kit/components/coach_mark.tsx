import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { softSpring } from '../motion'
import { cx, useOnce } from '../utils'

type Props = {
  /** Clé unique : une fois fermé, le coach mark ne revient plus (localStorage). */
  id: string
  title: string
  text: string
  /** Permet de conditionner l'affichage (ex. seulement après le premier résultat). */
  when?: boolean
  placement?: 'top' | 'bottom'
  /** start = bulle alignée sur le bord gauche de la cible (sûr près d'un bord), center = centrée. */
  align?: 'start' | 'center'
  ctaLabel?: string
  children: ReactNode
  className?: string
}

/**
 * Aide contextuelle unique, ancrée sur l'élément concerné.
 * Friction traitée : pas de tuto en 6 écrans. Une seule bulle, au bon moment, sur la bonne action.
 * Règle : un seul CoachMark visible à la fois par écran.
 */
export function CoachMark({
  id,
  title,
  text,
  when = true,
  placement = 'bottom',
  align = 'start',
  ctaLabel = "J'ai compris",
  children,
  className,
}: Props) {
  const [pending, markDone] = useOnce(id)
  const open = pending && when

  return (
    <span
      className={cx('relative inline-flex', className)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) markDone()
      }}
    >
      {children}
      <AnimatePresence>
        {open && (
          <>
            <span className="pointer-events-none absolute -right-1 -top-1 flex size-3" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex size-3 rounded-full bg-accent" />
            </span>
            <motion.div
              role="dialog"
              aria-label={title}
              initial={{ opacity: 0, y: placement === 'bottom' ? -6 : 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
              transition={{ ...softSpring, delay: 0.4 }}
              className={cx(
                'absolute z-40 w-64 rounded-md bg-ink p-4 text-left text-sm text-canvas shadow-card',
                placement === 'bottom' ? 'top-full mt-3' : 'bottom-full mb-3',
                align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0'
              )}
            >
              <span
                className={cx(
                  'absolute size-3 rotate-45 bg-ink',
                  align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-6',
                  placement === 'bottom' ? '-top-1.5' : '-bottom-1.5'
                )}
              />
              <p className="font-semibold">{title}</p>
              <p className="mt-1 text-canvas/80">{text}</p>
              <button
                onClick={markDone}
                className="mt-3 rounded-sm bg-accent px-3 py-1.5 text-xs font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {ctaLabel}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </span>
  )
}
