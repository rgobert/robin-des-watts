import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { spring } from '../motion'

type ToastInput = {
  message: string
  /** Libellé du bouton d'action, ex. « Annuler ». */
  actionLabel?: string
  onAction?: () => void
  /** ms avant disparition. */
  duration?: number
  tone?: 'neutral' | 'success'
}
type ToastItem = ToastInput & { id: number }

const ToastContext = createContext<(t: ToastInput) => void>(() => {})

/** `const toast = useToast(); toast({ message: 'Mode Smart désactivé', actionLabel: 'Annuler', onAction: undo })` */
export const useToast = () => useContext(ToastContext)

/**
 * Toasts avec annulation.
 * Friction traitée : remplace les modales « Êtes-vous sûr ? ». On agit tout de suite, on peut revenir en arrière.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), [])

  const push = useCallback((t: ToastInput) => {
    const id = nextId.current++
    setItems((xs) => [...xs.slice(-2), { ...t, id, duration: t.duration ?? 5000 }])
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <ToastCard key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

/**
 * Un toast : le minuteur et la barre de progression se mettent en pause au survol et au focus
 * (WCAG 2.2.1), pour laisser le temps d'atteindre « Annuler » au clavier ou au doigt.
 */
function ToastCard({ item: t, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const total = t.duration ?? 5000
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const paused = hovered || focused
  const remaining = useRef(total)
  const startedAt = useRef(0)
  const bar = useMotionValue(100)
  const barWidth = useTransform(bar, (v) => `${v}%`)

  useEffect(() => {
    if (paused) return
    startedAt.current = Date.now()
    const timer = setTimeout(() => onDismiss(t.id), remaining.current)
    const run = animate(bar, 0, { duration: remaining.current / 1000, ease: 'linear' })
    return () => {
      clearTimeout(timer)
      run.stop()
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current))
    }
  }, [paused, onDismiss, t.id, bar])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.15 } }}
      transition={spring}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className="pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-md bg-ink text-sm text-canvas shadow-card"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {t.tone === 'success' && <span className="size-2 shrink-0 rounded-full bg-success" />}
        <span className="flex-1">{t.message}</span>
        {t.actionLabel && (
          <button
            className="min-h-8 rounded-sm px-2 py-1 font-semibold text-accent hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-accent"
            onClick={() => {
              t.onAction?.()
              onDismiss(t.id)
            }}
          >
            {t.actionLabel}
          </button>
        )}
      </div>
      <motion.div
        className="absolute bottom-0 left-0 h-0.5 bg-accent/70"
        style={{ width: barWidth }}
        aria-hidden
      />
    </motion.div>
  )
}
