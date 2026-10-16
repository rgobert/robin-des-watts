import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState, type FocusEvent } from 'react'
import type { Fact, FactKind } from '../content/facts'
import { duration, ease, softSpring } from '../motion'
import { cx } from '../utils'
import { AssistantAvatar } from './assistant_avatar'

type Props = {
  facts: Fact[]
  /**
   * card = encart inline avec progression façon « stories » ;
   * bubble = bulle de dialogue portée par l'avatar (personnification) ;
   * floating = pastille qui surgit en bas à droite pendant une attente.
   */
  variant?: 'card' | 'bubble' | 'floating'
  /** ms par fait */
  interval?: number
  /** floating : délai avant apparition (ms). */
  delay?: number
  onDismiss?: () => void
  className?: string
}

/**
 * « Le saviez-vous ? » : faits pédagogiques qui tournent pendant une attente.
 * Friction traitée : l'attente devient un moment d'apprentissage, et le chiffre prépare le résultat.
 * Pause au survol, navigation au clic sur les segments.
 */
export function DidYouKnow({
  facts,
  variant = 'card',
  interval = 5200,
  delay = 1200,
  onDismiss,
  className,
}: Props) {
  const reduce = useReducedMotion()
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(variant !== 'floating')

  useEffect(() => {
    if (variant !== 'floating') return
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [variant, delay])

  useEffect(() => {
    if (paused || !visible || facts.length < 2) return
    const t = setTimeout(() => setI((x) => (x + 1) % facts.length), interval)
    return () => clearTimeout(t)
  }, [i, paused, visible, interval, facts.length])

  const fact = facts[i]
  const dismiss = () => {
    setVisible(false)
    onDismiss?.()
  }

  const body = (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: reduce ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -6 }}
          transition={{ duration: duration.base, ease: ease.out }}
        >
          <p className="text-[15px] leading-snug text-ink">{fact.text}</p>
          {fact.source && <p className="mt-1.5 text-xs text-ink-muted">Source : {fact.source}</p>}
        </motion.div>
      </AnimatePresence>
      {facts.length > 1 && (
        <div className="mt-3 flex gap-1" role="tablist" aria-label="Faits">
          {facts.map((_, k) => (
            <button
              key={k}
              role="tab"
              aria-selected={k === i}
              aria-label={`Fait ${k + 1} sur ${facts.length}`}
              onClick={() => setI(k)}
              className="group flex h-6 flex-1 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="block h-1 w-full overflow-hidden rounded-full bg-line">
                {k < i && <span className="block h-full w-full bg-ink-muted/60" />}
                {k === i && (
                  <motion.span
                    key={`${i}-${paused}`}
                    className="block h-full bg-primary"
                    initial={{ width: paused ? '100%' : 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: paused ? 0 : interval / 1000, ease: 'linear' }}
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  )

  const header = (
    <div className="mb-2 flex items-center gap-2">
      <KindIcon kind={fact.kind} />
      <span className="text-xs font-semibold uppercase tracking-wide text-primary">
        Le saviez-vous ?
      </span>
      {variant !== 'card' && (
        <button
          onClick={dismiss}
          aria-label="Fermer"
          className="-m-1.5 ml-auto grid size-8 place-items-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
        >
          <svg viewBox="0 0 12 12" className="size-3">
            <path
              d="M2 2l8 8M10 2l-8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  )

  // Pause au survol ET au focus (clavier, lecteur d'écran) : contenu qui défile seul > 5 s (WCAG 2.2.2).
  const hover = {
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false),
    onFocus: () => setPaused(true),
    onBlur: (e: FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false)
    },
  }

  if (variant === 'bubble')
    return (
      <AnimatePresence>
        {visible && (
          <motion.div
            className={cx('flex items-end gap-3', className)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={softSpring}
            aria-live={paused ? 'polite' : 'off'}
            {...hover}
          >
            <AssistantAvatar mood="idle" />
            <div className="relative flex-1 rounded-lg rounded-bl-sm border border-line bg-surface p-4 shadow-card">
              {header}
              {body}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    )

  if (variant === 'floating')
    return (
      <AnimatePresence>
        {visible && (
          <motion.div
            className={cx(
              'fixed right-4 bottom-4 z-40 w-[min(320px,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-4 shadow-card',
              className
            )}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97, transition: { duration: 0.15 } }}
            transition={softSpring}
            aria-live={paused ? 'polite' : 'off'}
            {...hover}
          >
            {header}
            {body}
          </motion.div>
        )}
      </AnimatePresence>
    )

  return (
    <div
      className={cx('rounded-md border border-line bg-surface p-4', className)}
      aria-live={paused ? 'polite' : 'off'}
      {...hover}
    >
      {header}
      {body}
    </div>
  )
}

const KIND_COLOR: Record<FactKind, string> = {
  solar: 'var(--color-solar)',
  battery: 'var(--color-battery)',
  grid: 'var(--color-grid)',
  reward: 'var(--color-reward)',
  tip: 'var(--color-primary)',
}

function KindIcon({ kind = 'tip' }: { kind?: FactKind }) {
  const c = KIND_COLOR[kind]
  return (
    <span
      className="grid size-6 place-items-center rounded-full"
      style={{ background: `color-mix(in oklab, ${c} 16%, transparent)` }}
      aria-hidden
    >
      <svg
        viewBox="0 0 16 16"
        className="size-3.5"
        fill="none"
        stroke={c}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {kind === 'solar' && (
          <>
            <circle cx="8" cy="8" r="3" fill={c} />
            <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
          </>
        )}
        {kind === 'battery' && (
          <>
            <rect x="4" y="3" width="8" height="11" rx="2" />
            <path d="M6.5 1.5h3" />
            <rect x="6" y="8" width="4" height="4" rx="1" fill={c} stroke="none" />
          </>
        )}
        {kind === 'grid' && <path d="M5 14L8 2l3 12M6 9h4M3.5 5h9" />}
        {kind === 'reward' && (
          <>
            <circle cx="8" cy="8" r="5.5" />
            <path d="M8 5v6M6.2 6.6c0-.9.8-1.4 1.8-1.4s1.8.5 1.8 1.3c0 1.8-3.6 1.1-3.6 3 0 .8.8 1.3 1.8 1.3s1.8-.5 1.8-1.4" />
          </>
        )}
        {kind === 'tip' && (
          <>
            <path d="M5.5 10.5a4 4 0 1 1 5 0V12h-5z" />
            <path d="M6.5 14h3" />
          </>
        )}
      </svg>
    </span>
  )
}
