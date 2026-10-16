import { AnimatePresence, motion } from 'motion/react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { duration, spring } from '../motion'
import { cx } from '../utils'

type State = 'idle' | 'loading' | 'success'

type Props = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'
> & {
  state?: State
  variant?: 'primary' | 'secondary' | 'ghost'
  loadingLabel?: string
  successLabel?: string
  children: ReactNode
}

/**
 * Bouton avec retour physique (press) et états intégrés : chargement puis succès, sans saut de largeur.
 * Friction traitée : « est-ce que mon clic a marché ? »
 */
export function ActionButton({
  state = 'idle',
  variant = 'primary',
  loadingLabel,
  successLabel,
  children,
  className,
  disabled,
  ...rest
}: Props) {
  const label =
    state === 'loading'
      ? (loadingLabel ?? children)
      : state === 'success'
        ? (successLabel ?? children)
        : children
  return (
    <motion.button
      whileTap={state === 'idle' && !disabled ? { scale: 0.97 } : undefined}
      transition={spring}
      disabled={disabled || state !== 'idle'}
      aria-busy={state === 'loading'}
      className={cx(
        'relative inline-flex h-11 items-center justify-center gap-2 overflow-hidden rounded-full px-6 text-sm font-semibold transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default',
        variant === 'primary' && 'bg-primary text-primary-contrast hover:bg-primary/90',
        variant === 'secondary' && 'border border-line bg-surface text-ink hover:border-ink/30',
        variant === 'ghost' && 'text-primary hover:bg-primary/5',
        state === 'success' && variant === 'primary' && 'bg-success hover:bg-success',
        className
      )}
      {...rest}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {state === 'loading' && (
          <motion.span
            key="spin"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <span className="kit-spin block size-4 rounded-full border-2 border-current/30 border-t-current" />
          </motion.span>
        )}
        {state === 'success' && (
          <motion.svg
            key="check"
            viewBox="0 0 16 16"
            className="size-4"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.path
              d="M3.5 8.5l3 3 6-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: duration.base }}
            />
          </motion.svg>
        )}
        <motion.span
          key={String(state)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: duration.fast }}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
