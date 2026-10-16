import { motion, useReducedMotion } from 'motion/react'
import { cx } from '../utils'

export type Mood = 'idle' | 'thinking' | 'happy' | 'working' | 'sleeping'

type Props = {
  mood?: Mood
  size?: number
  className?: string
}

/**
 * Personnification minimale (piste DA à valider) : un coffret avec deux yeux.
 * Les humeurs disent l'état du système sans texte : il réfléchit, il travaille, il a gagné, il dort (la nuit).
 */
export function AssistantAvatar({ mood = 'idle', size = 44, className }: Props) {
  const reduce = useReducedMotion()
  const eyeY = mood === 'thinking' ? 17 : 20

  return (
    <motion.svg
      viewBox="0 0 44 44"
      width={size}
      height={size}
      className={cx('shrink-0', className)}
      aria-hidden
      animate={reduce ? undefined : mood === 'working' ? { y: [0, -1.5, 0] } : { y: 0 }}
      transition={{ duration: 0.6, repeat: mood === 'working' ? Infinity : 0 }}
    >
      <rect x="4" y="6" width="36" height="32" rx="10" fill="var(--color-primary)" />
      <rect x="9" y="11" width="26" height="18" rx="6" fill="var(--color-surface)" opacity="0.14" />

      {mood === 'happy' ? (
        <g stroke="var(--color-accent)" strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d="M13 21 Q16 17 19 21" />
          <path d="M25 21 Q28 17 31 21" />
        </g>
      ) : mood === 'sleeping' ? (
        <g stroke="var(--color-accent)" strokeWidth="2.4" strokeLinecap="round">
          <line x1="13" y1="20" x2="19" y2="20" />
          <line x1="25" y1="20" x2="31" y2="20" />
        </g>
      ) : (
        <motion.g
          fill="var(--color-accent)"
          animate={
            reduce
              ? undefined
              : mood === 'thinking'
                ? { x: [0, 2, 0, -2, 0] }
                : { scaleY: [1, 1, 0.1, 1, 1] }
          }
          transition={{
            duration: mood === 'thinking' ? 1.6 : 4,
            repeat: Infinity,
            times: mood === 'thinking' ? undefined : [0, 0.9, 0.93, 0.96, 1],
          }}
          style={{ transformOrigin: `22px ${eyeY}px` }}
        >
          <rect x="13" y={eyeY - 3} width="6" height="6" rx="3" />
          <rect x="25" y={eyeY - 3} width="6" height="6" rx="3" />
        </motion.g>
      )}

      {mood === 'working' && (
        <motion.path
          d="M23 28 l-3 5 h3 l-2 4 l5 -6 h-3 l2 -3 z"
          fill="var(--color-accent)"
          animate={reduce ? undefined : { opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
      {mood === 'sleeping' && (
        <motion.text
          x="34"
          y="8"
          fontSize="8"
          fill="var(--color-ink-muted)"
          animate={reduce ? undefined : { opacity: [0, 1, 0], y: [8, 3, 0] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        >
          z
        </motion.text>
      )}
    </motion.svg>
  )
}
