import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { QUIZ } from '../content/facts'
import { duration, ease, spring } from '../motion'
import { cx } from '../utils'

type Question = { q: string; answer: boolean; explain: string }

type Props = {
  questions?: Question[]
  onEnd?: (score: number) => void
  className?: string
}

/**
 * Quiz Vrai / Faux de 3 questions, avec explication après chaque réponse.
 * Pour une attente de 10-20 s : pédagogie + engagement, et l'utilisateur arrive au résultat déjà convaincu.
 */
export function EnergyQuiz({ questions = QUIZ, onEnd, className }: Props) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<boolean | null>(null)
  const [score, setScore] = useState(0)
  const finished = i >= questions.length
  const q = questions[Math.min(i, questions.length - 1)]

  const pick = (v: boolean) => {
    if (picked !== null) return
    setPicked(v)
    if (v === q.answer) setScore((s) => s + 1)
  }
  const next = () => {
    const ni = i + 1
    setPicked(null)
    setI(ni)
    if (ni >= questions.length) onEnd?.(score)
  }

  return (
    <div
      className={cx(
        'relative min-h-56 overflow-hidden rounded-lg border border-line bg-surface p-5',
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between text-xs text-ink-muted">
        <span className="font-semibold uppercase tracking-wide text-primary">Vrai ou faux ?</span>
        <span className="tabular-nums">
          {finished ? 'Terminé' : `${i + 1} / ${questions.length}`}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {finished ? (
          <motion.div
            key="end"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring}
            className="py-6 text-center"
          >
            <p className="font-display text-4xl text-ink tabular-nums">
              {score} / {questions.length}
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              {score === questions.length
                ? 'Vous pensez déjà comme Robin.'
                : 'Vous en savez plus que la plupart des foyers.'}
            </p>
            <button
              onClick={() => {
                setI(0)
                setScore(0)
              }}
              className="mt-4 text-sm font-medium text-primary"
            >
              Rejouer
            </button>
          </motion.div>
        ) : (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: duration.base, ease: ease.out }}
          >
            <p className="text-[17px] leading-snug text-ink">{q.q}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[true, false].map((v) => {
                const isPicked = picked === v
                const good = picked !== null && v === q.answer
                const bad = isPicked && v !== q.answer
                return (
                  <motion.button
                    key={String(v)}
                    whileTap={picked === null ? { scale: 0.97 } : undefined}
                    animate={bad ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
                    transition={{ duration: 0.35 }}
                    onClick={() => pick(v)}
                    disabled={picked !== null}
                    className={cx(
                      'h-11 rounded-full border text-sm font-semibold transition-colors',
                      picked === null && 'border-line bg-surface text-ink hover:border-primary',
                      good && 'border-success bg-success text-primary-contrast',
                      bad && 'border-danger bg-danger/10 text-danger',
                      picked !== null && !good && !bad && 'border-line text-ink-muted'
                    )}
                  >
                    {v ? 'Vrai' : 'Faux'}
                  </motion.button>
                )
              })}
            </div>
            <AnimatePresence>
              {picked !== null && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: duration.base, ease: ease.out }}
                  className="overflow-hidden"
                >
                  <p className="mt-4 text-sm text-ink">
                    <span
                      className={cx(
                        'font-semibold',
                        picked === q.answer ? 'text-success' : 'text-danger'
                      )}
                    >
                      {picked === q.answer ? 'Exact. ' : 'Pas tout à fait. '}
                    </span>
                    {q.explain}
                  </p>
                  <button onClick={next} className="mt-3 text-sm font-medium text-primary">
                    {i + 1 < questions.length ? 'Question suivante →' : 'Voir mon score →'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
