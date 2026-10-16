import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useToast } from '../components/toast'
import { duration, ease, spring } from '../motion'
import { cx } from '../utils'
import { WARNING_TEXT } from './chart_utils'
import type { AlertSeverity, OpsAlert } from './mocks'

const SEV: Record<AlertSeverity, { label: string; text: string; bar: string; icon: string }> = {
  critique: {
    label: 'Critique',
    text: 'text-danger',
    bar: 'bg-danger',
    icon: 'M6 1.5 11 10.5H1L6 1.5ZM6 5v2.4M6 8.9v.1',
  },
  majeure: {
    label: 'Majeure',
    text: WARNING_TEXT,
    bar: 'bg-warning',
    icon: 'M6 1.2a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6ZM6 3.6v3M6 8.3v.1',
  },
  mineure: {
    label: 'Mineure',
    text: 'text-ink-muted',
    bar: 'bg-grid',
    icon: 'M6 1.2a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6ZM6 5.4v3M6 3.6v.1',
  },
}
const ORDER: AlertSeverity[] = ['critique', 'majeure', 'mineure']

const ago = (at: number, now: number) => {
  const m = Math.max(0, Math.round((now - at) / 60_000))
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  return `il y a ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}

/**
 * Flux d'alertes ops temps réel : les nouvelles entrent en haut, filtrage par gravité, acquittement avec annulation.
 * Friction traitée : un canal d'alertes bruyant fait rater la seule qui compte ; la gravité se lit (icône + libellé),
 * se filtre, et une alerte traitée sort du flux sans être perdue.
 * Passer `incoming` (une alerte à la fois, nouvel `id`) pour pousser une alerte en direct.
 * Pendant que la souris survole la liste ou que le focus y est, les nouvelles alertes sont mises en attente
 * (bouton « N nouvelles alertes ») pour ne pas déplacer la cible sous le curseur ; elles entrent à la sortie.
 * `live={false}` : flux en pause (pastille fixe, libellé « En pause »).
 */
export function AlertFeed({
  initial,
  incoming,
  now: nowProp,
  title = 'Alertes ops',
  maxItems = 8,
  onOpen,
  live = true,
  className,
}: {
  initial: OpsAlert[]
  /** Nouvelle alerte poussée de l'extérieur (websocket, polling…). */
  incoming?: OpsAlert | null
  /** Horloge de référence (ms) pour « il y a x min ». */
  now?: number
  title?: string
  maxItems?: number
  onOpen?: (a: OpsAlert) => void
  /** Flux en direct (défaut). `false` : pastille sans pulsation, libellé « En pause ». */
  live?: boolean
  className?: string
}) {
  const toast = useToast()
  const reduce = useReducedMotion()
  const [alerts, setAlerts] = useState(initial)
  const [filter, setFilter] = useState<AlertSeverity | 'toutes'>('toutes')
  const [fresh, setFresh] = useState<string[]>([])
  // Horloge des « il y a X min », rafraîchie toutes les 30 s.
  const [clock, setClock] = useState(() => Date.now())
  useEffect(() => {
    if (nowProp !== undefined) return
    const t = setInterval(() => setClock(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [nowProp])
  const now = nowProp ?? clock

  // Survol / focus dans la liste : les nouvelles alertes attendent (pas de saut sous le curseur).
  const [hover, setHover] = useState(false)
  const [focusIn, setFocusIn] = useState(false)
  const hold = hover || focusIn
  const holdRef = useRef(hold)
  useLayoutEffect(() => {
    holdRef.current = hold
  })
  const [queued, setQueued] = useState<OpsAlert[]>([])
  const listRef = useRef<HTMLUListElement>(null)
  const freshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const insert = (items: OpsAlert[]) => {
    if (!items.length) return
    setAlerts((xs) => {
      const add = items.filter((a) => !xs.some((x) => x.id === a.id))
      return add.length ? [...add, ...xs] : xs
    })
    setFresh(items.map((a) => a.id))
    if (freshTimer.current) clearTimeout(freshTimer.current)
    freshTimer.current = setTimeout(() => setFresh([]), 2400)
  }
  useEffect(
    () => () => {
      if (freshTimer.current) clearTimeout(freshTimer.current)
    },
    []
  )

  useEffect(() => {
    if (!incoming) return
    if (holdRef.current)
      setQueued((q) => (q.some((x) => x.id === incoming.id) ? q : [incoming, ...q]))
    else insert([incoming])
  }, [incoming])

  // Appelé à la sortie du survol / focus : on insère ce qui attendait.
  const flush = () => {
    if (!queued.length) return
    insert(queued)
    setQueued([])
  }

  const counts = ORDER.reduce<Record<string, number>>(
    (c, s) => ({ ...c, [s]: alerts.filter((a) => a.severity === s).length }),
    {}
  )
  const shown = alerts
    .filter((a) => filter === 'toutes' || a.severity === filter)
    .slice(0, maxItems)

  const ack = (a: OpsAlert) => {
    const index = alerts.findIndex((x) => x.id === a.id)
    setAlerts((xs) => xs.filter((x) => x.id !== a.id))
    toast({
      message: `Alerte acquittée : ${a.title}`,
      actionLabel: 'Annuler',
      onAction: () =>
        setAlerts((xs) => {
          const copy = [...xs]
          copy.splice(Math.min(index, copy.length), 0, a)
          return copy
        }),
    })
  }

  return (
    <section
      className={cx('min-w-0 rounded-md border border-line bg-surface shadow-card', className)}
      aria-label={title}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <span className="relative flex size-2" aria-hidden>
            {live && !reduce && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-50" />
            )}
            <span
              className={cx(
                'relative inline-flex size-2 rounded-full',
                live ? 'bg-danger' : 'bg-ink-muted'
              )}
            />
          </span>
          {title}
          <span className="font-normal text-ink-muted">· {live ? 'en direct' : 'En pause'}</span>
        </h4>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrer par gravité">
          {(['toutes', ...ORDER] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={filter === k}
              onClick={() => setFilter(k)}
              className={cx(
                'rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary',
                filter === k
                  ? 'bg-ink text-canvas'
                  : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
              )}
            >
              {k === 'toutes' ? 'Toutes' : SEV[k].label}
              <span className={cx('ml-1 tabular-nums', filter === k && 'opacity-70')}>
                {k === 'toutes' ? alerts.length : counts[k]}
              </span>
            </button>
          ))}
        </div>
      </header>

      <div
        onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
        onPointerLeave={() => {
          setHover(false)
          if (!focusIn) flush()
        }}
        onFocus={() => setFocusIn(true)}
        onBlur={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
          setFocusIn(false)
          if (!hover) flush()
        }}
      >
        <AnimatePresence initial={false}>
          {queued.length > 0 && (
            <motion.div
              key="queued"
              initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: duration.fast, ease: ease.out }}
              className="overflow-hidden border-b border-line"
            >
              <button
                type="button"
                onClick={() => {
                  // Le focus reste dans la liste (le bouton disparaît) : la mise en attente continue pour la suite.
                  listRef.current?.focus({ preventScroll: true })
                  flush()
                }}
                className="flex min-h-11 w-full items-center justify-center gap-2 bg-danger/5 px-4 text-sm font-semibold text-danger hover:bg-danger/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
              >
                <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                  <path
                    d="M6 10V2M2.5 5.5 6 2l3.5 3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {queued.length} {queued.length > 1 ? 'nouvelles alertes' : 'nouvelle alerte'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <ul
          ref={listRef}
          tabIndex={-1}
          className="divide-y divide-line outline-none"
          aria-live="polite"
          aria-relevant="additions"
        >
          <AnimatePresence initial={false}>
            {shown.map((a) => {
              const s = SEV[a.severity]
              return (
                <motion.li
                  key={a.id}
                  layout={reduce ? false : 'position'}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={
                    reduce
                      ? { opacity: 0 }
                      : {
                          opacity: 0,
                          height: 0,
                          transition: { duration: duration.base, ease: ease.inOut },
                        }
                  }
                  transition={reduce ? { duration: duration.fast } : spring}
                  className="overflow-hidden"
                >
                  <div
                    className={cx(
                      'relative flex gap-3 px-4 py-3 transition-colors duration-700',
                      fresh.includes(a.id) && 'bg-danger/5'
                    )}
                  >
                    <span
                      className={cx('absolute inset-y-2 left-0 w-0.5 rounded-full', s.bar)}
                      aria-hidden
                    />
                    <svg
                      viewBox="0 0 12 12"
                      className={cx('mt-0.5 size-4 shrink-0', s.text)}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d={s.icon} />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">
                        <span className="sr-only">{s.label} : </span>
                        {a.title}
                        {fresh.includes(a.id) && (
                          <span className="ml-2 rounded-full bg-danger px-1.5 py-px align-middle text-[10px] font-semibold text-primary-contrast">
                            Nouveau
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-ink-muted">{a.detail}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        <span className={cx('font-medium', s.text)}>{s.label}</span> · {a.source} ·{' '}
                        {ago(a.at, now)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-start">
                      {onOpen && (
                        <button
                          type="button"
                          onClick={() => onOpen(a)}
                          className="rounded-full px-2.5 py-1 text-xs font-medium text-primary hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
                        >
                          Ouvrir
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => ack(a)}
                        className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        Acquitter
                      </button>
                    </div>
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      </div>
      {shown.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-ink-muted">
          Rien à signaler à ce niveau de gravité.
        </p>
      )}
    </section>
  )
}
