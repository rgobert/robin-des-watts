import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { duration, ease, fadeUp, stagger } from '../motion'
import { cx } from '../utils'
import { AssistantAvatar, type Mood } from './assistant_avatar'

type Props = {
  /**
   * Texte complet. Il peut grandir au fil d'un vrai stream LLM : le composant continue
   * d'écrire là où il en était.
   */
  text: string
  /** true pendant que la réponse arrive (affiche « en train d'écrire » si texte vide). */
  streaming?: boolean
  name?: string
  avatar?: ReactNode
  mood?: Mood
  /** ms par mot pour l'effet machine à écrire. 0 = affichage direct. */
  msPerWord?: number
  suggestions?: string[]
  onSuggestion?: (s: string) => void
  className?: string
}

/**
 * Bulle d'assistant qui s'écrit au fil de l'eau, avec questions suggérées.
 * Friction traitée : un résultat brut devient une explication à la 2e personne,
 * et l'utilisateur n'a pas à formuler sa question suivante.
 */
export function AssistantBubble({
  text,
  streaming = false,
  name = 'Robin',
  avatar,
  mood,
  msPerWord = 45,
  suggestions = [],
  onSuggestion,
  className,
}: Props) {
  const reduce = useReducedMotion()
  const words = text.split(/(\s+)/)
  const [shown, setShown] = useState(0)
  const instant = reduce || msPerWord === 0
  const prevText = useRef(text)

  // Nouvelle réponse (pas une suite du stream) : on recommence à écrire depuis le début.
  useEffect(() => {
    if (!text.startsWith(prevText.current)) setShown(0)
    prevText.current = text
  }, [text])

  useEffect(() => {
    if (instant || shown >= words.length) return
    const t = setTimeout(() => setShown((s) => s + 2), msPerWord)
    return () => clearTimeout(t)
  }, [shown, words.length, msPerWord, instant])

  const visible = instant ? text : words.slice(0, shown).join('')
  const writing = !instant && shown < words.length
  const thinking = streaming && text.length === 0
  const finished = !writing && !streaming

  return (
    <div className={cx('flex items-start gap-3', className)}>
      {avatar ?? (
        <AssistantAvatar mood={mood ?? (thinking ? 'thinking' : finished ? 'idle' : 'working')} />
      )}
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-medium text-ink-muted">{name}</p>
        <motion.div
          layout
          className="rounded-lg rounded-tl-sm border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink shadow-card"
          aria-live="polite"
          aria-busy={!finished}
        >
          {thinking ? (
            <TypingDots />
          ) : (
            <>
              {visible}
              {(writing || streaming) && (
                <span
                  className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-primary"
                  style={{ animation: 'kit-caret 1s steps(1) infinite' }}
                />
              )}
            </>
          )}
        </motion.div>

        <AnimatePresence>
          {finished && suggestions.length > 0 && (
            <motion.div
              className="mt-3 flex flex-wrap gap-2"
              variants={stagger(0.06)}
              initial="hidden"
              animate="show"
            >
              {suggestions.map((s) => (
                <motion.button
                  key={s}
                  variants={fadeUp}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onSuggestion?.(s)}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {s}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="flex h-6 items-center gap-1" aria-label="En train d'écrire">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-ink-muted"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{
            duration: duration.story * 1.4,
            repeat: Infinity,
            delay: i * 0.15,
            ease: ease.inOut,
          }}
        />
      ))}
    </span>
  )
}
