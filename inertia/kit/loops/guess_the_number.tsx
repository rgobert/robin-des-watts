import { AnimatePresence, motion } from 'motion/react'
import { useId, useState } from 'react'
import { AnimatedNumber } from '../components/animated_number'
import { ease, spring } from '../motion'
import { cx } from '../utils'

type Props = {
  question: string
  min: number
  max: number
  step?: number
  unit: string
  /**
   * La vraie valeur. Peut arriver plus tard (résultat de la simulation en cours) :
   * tant qu'elle est undefined, la révélation attend le calcul.
   */
  answer?: number
  initial?: number
  source?: string
  onReveal?: (guess: number, answer: number) => void
  className?: string
}

/**
 * « Devinez » : l'utilisateur estime un chiffre pendant que le vrai se calcule, puis on compare.
 * Personnalisation : la réponse peut être SON résultat. L'attente devient du suspense.
 */
export function GuessTheNumber({
  question,
  min,
  max,
  step = 10,
  unit,
  answer,
  initial,
  source,
  onReveal,
  className,
}: Props) {
  const id = useId()
  const [guess, setGuess] = useState(initial ?? Math.round((min + max) / 2 / step) * step)
  const [locked, setLocked] = useState(false)
  const revealed = locked && answer !== undefined
  const pct = (v: number) => ((v - min) / (max - min)) * 100
  const diff = answer !== undefined ? Math.abs(answer - guess) : 0
  const fmt = (v: number) => v.toLocaleString('fr-FR')

  return (
    <div className={cx('rounded-lg border border-line bg-surface p-5', className)}>
      <span className="text-xs font-semibold uppercase tracking-wide text-primary">Devinez</span>
      <label htmlFor={id} className="mt-2 block text-[17px] leading-snug text-ink">
        {question}
      </label>

      <p className="mt-4 font-display text-4xl text-ink tabular-nums">
        {fmt(guess)} <span className="text-xl text-ink-muted">{unit}</span>
      </p>

      <div className="relative mt-4 h-10">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={guess}
          disabled={locked}
          onChange={(e) => setGuess(Number(e.target.value))}
          className="absolute inset-x-0 top-3 w-full accent-[var(--color-primary)] disabled:opacity-60"
        />
        <AnimatePresence>
          {revealed && (
            <motion.div
              className="pointer-events-none absolute top-0 flex -translate-x-1/2 flex-col items-center"
              initial={{ left: `${pct(guess)}%`, opacity: 0 }}
              animate={{ left: `${pct(answer!)}%`, opacity: 1 }}
              transition={{ duration: 0.9, ease: ease.out }}
            >
              <span className="h-10 w-0.5 rounded-full bg-reward" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex justify-between text-xs text-ink-muted tabular-nums">
        <span>{fmt(min)}</span>
        <span>{fmt(max)}</span>
      </div>

      <AnimatePresence mode="wait">
        {!locked && (
          <motion.button
            key="go"
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              setLocked(true)
              if (answer !== undefined) onReveal?.(guess, answer)
            }}
            className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-contrast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Valider mon estimation
          </motion.button>
        )}
        {locked && !revealed && (
          <motion.p
            key="wait"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 flex items-center gap-2 text-sm text-ink-muted"
          >
            <span className="kit-spin size-3.5 rounded-full border-2 border-primary/25 border-t-primary" />{' '}
            Votre vrai chiffre arrive…
          </motion.p>
        )}
        {revealed && (
          <motion.div
            key="res"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="mt-4"
          >
            <p className="text-sm text-ink-muted">Votre vrai chiffre</p>
            <p className="font-display text-3xl text-reward">
              <AnimatedNumber value={answer!} suffix={` ${unit}`} />
            </p>
            <p className="mt-1 text-sm text-ink">
              {diff <= step
                ? 'Dans le mille.'
                : `Vous étiez à ${fmt(diff)} ${unit} près${answer! > guess ? ' : bonne surprise.' : '.'}`}
            </p>
            {source && <p className="mt-2 text-xs text-ink-muted">{source}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
