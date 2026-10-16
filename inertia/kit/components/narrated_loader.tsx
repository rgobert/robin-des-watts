import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { duration, ease } from '../motion'
import { cx } from '../utils'

type Props = {
  /** Ce que le système fait vraiment, à la 1re personne ou à l'infinitif. 3-4 étapes. */
  steps: string[]
  /** Durée d'affichage de chaque étape en mode auto (ms). */
  stepMs?: number
  /**
   * Mode contrôlé : laisser `false` pendant l'appel réel, passer à `true` quand le résultat arrive.
   * Le loader reste sur la dernière étape tant que `done` est false.
   * Laisser `undefined` pour un déroulé automatique (démo mockée).
   */
  done?: boolean
  onDone?: () => void
  /** Faits pédagogiques qui tournent sous les étapes pendant l'attente. */
  facts?: string[]
  className?: string
}

/**
 * Chargement qui raconte ce qu'il fait.
 * Friction traitée : l'attente muette (« ça plante ? ») devient un moment de pédagogie et de confiance.
 */
export function NarratedLoader({ steps, stepMs = 900, done, onDone, facts, className }: Props) {
  const [index, setIndex] = useState(0)
  const onDoneRef = useRef(onDone)
  useLayoutEffect(() => {
    onDoneRef.current = onDone
  })

  const cap = done === false ? steps.length - 1 : steps.length

  useEffect(() => {
    if (index >= cap) return
    const t = setTimeout(() => setIndex((i) => i + 1), done ? 160 : stepMs)
    return () => clearTimeout(t)
  }, [index, cap, stepMs, done])

  useEffect(() => {
    if (index < steps.length) return
    const t = setTimeout(() => onDoneRef.current?.(), 380)
    return () => clearTimeout(t)
  }, [index, steps.length])

  const progress = Math.min(index / steps.length, 1)

  return (
    <div className={cx('w-full max-w-sm', className)} role="status" aria-live="polite">
      <div className="h-1 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(progress * 100, 6)}%` }}
          transition={{ duration: duration.slow, ease: ease.out }}
        />
      </div>

      <ol className="mt-5 space-y-3">
        {steps.map((label, i) => {
          const state = i < index ? 'done' : i === index ? 'active' : 'todo'
          return (
            <motion.li
              key={label}
              className="flex items-center gap-3 text-sm"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: state === 'todo' ? 0.4 : 1, y: 0 }}
              transition={{ duration: duration.base, ease: ease.out, delay: i * 0.05 }}
            >
              <StepIcon state={state} />
              <span className={cx(state === 'active' ? 'text-ink font-medium' : 'text-ink-muted')}>
                {label}
              </span>
            </motion.li>
          )
        })}
      </ol>

      {facts && facts.length > 0 && <RotatingFact facts={facts} />}
    </div>
  )
}

function StepIcon({ state }: { state: 'done' | 'active' | 'todo' }) {
  if (state === 'active')
    return (
      <span className="relative grid size-5 place-items-center">
        <span className="kit-spin size-4 rounded-full border-2 border-primary/25 border-t-primary" />
      </span>
    )
  if (state === 'done')
    return (
      <motion.svg
        viewBox="0 0 20 20"
        className="size-5 text-success"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 24 }}
      >
        <circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.15" />
        <motion.path
          d="M6 10.5l2.6 2.6L14 7.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: duration.base, ease: ease.out }}
        />
      </motion.svg>
    )
  return <span className="mx-1.5 size-2 rounded-full bg-line" />
}

function RotatingFact({ facts }: { facts: string[] }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % facts.length), 3800)
    return () => clearInterval(t)
  }, [facts.length])
  return (
    <div className="mt-6 min-h-12 rounded-sm bg-surface-2 px-4 py-3 text-sm text-ink/80">
      <span className="mr-1 font-medium text-ink">Le saviez-vous ?</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: duration.base }}
        >
          {facts[i]}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}
