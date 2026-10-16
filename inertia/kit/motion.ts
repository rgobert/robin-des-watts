import type { Transition, Variants } from 'motion/react'

/** Durées en secondes (Motion). Miroir des --dur-* de tokens.css. */
export const duration = {
  instant: 0.1,
  fast: 0.18,
  base: 0.26,
  slow: 0.42,
  story: 0.7,
} as const

export const ease = {
  out: [0.23, 1, 0.32, 1], // easing du site mylight150
  inOut: [0.65, 0, 0.35, 1],
} as const

export const spring: Transition = { type: 'spring', stiffness: 380, damping: 30 }
export const softSpring: Transition = { type: 'spring', stiffness: 220, damping: 26 }

/** Entrée standard : fade + 8px. À utiliser avec `stagger` sur le parent. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: duration.base, ease: ease.out } },
}

/** Parent qui fait entrer ses enfants un par un (40 ms, 6 enfants max conseillés). */
export const stagger = (delay = 0.04): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: delay } },
})

export const pressable = {
  whileTap: { scale: 0.97 },
  transition: spring,
} as const
