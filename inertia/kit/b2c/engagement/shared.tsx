import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from '../../utils'

/*
 * Outils internes du module engagement (non exportés par index.ts pour éviter les collisions).
 * Couleurs : uniquement des tokens du kit ; les teintes intermédiaires passent par color-mix.
 */

/** Teinte d'un token mélangée à la surface (0-100 %). Pour les échelles séquentielles à une seule teinte. */
export const tint = (token: string, pct: number) =>
  `color-mix(in oklab, var(--color-${token}) ${Math.round(Math.max(0, Math.min(100, pct)))}%, var(--color-surface))`

/** Teinte d'un token assombrie vers l'encre (lisibilité d'une teinte claire, ex. réseau à côté de batterie). */
export const shade = (token: string, pct: number) =>
  `color-mix(in oklab, var(--color-${token}) ${Math.round(100 - pct)}%, var(--color-ink))`

const nf = (d: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })
export const fmtNum = (v: number, d = 0) => nf(d).format(v)
export const fmtEur = (v: number, d = 2) => `${nf(d).format(v)} €`
export const fmtSignedEur = (v: number, d = 2) =>
  `${v >= 0 ? '+' : '−'}${nf(d).format(Math.abs(v))} €`

/** 11 → « 11h », 11.5 → « 11h30 ». */
export const fmtHour = (h: number) => {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return `${hh}h${mm ? String(mm).padStart(2, '0') : ''}`
}

/** Durée lisible sans secondes (pas de pression artificielle) : « 2 j 4 h », « 21 h 48 min », « 12 min ». */
export function fmtDuration(ms: number) {
  const min = Math.max(0, Math.floor(ms / 60000))
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  const m = min % 60
  if (d > 0) return `${d} j ${h} h`
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`
  return `${m} min`
}

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
export const fmtDay = (d: Date) => dayFmt.format(d)
export const fmtTime = (d: Date) => timeFmt.format(d).replace(':', 'h')

/**
 * Horloge : part de `start` (heure simulée de la démo) ou de maintenant, et avance en temps réel.
 * Le pas par défaut (15 s) suffit : on n'affiche jamais les secondes.
 */
export function useClock(start?: Date, stepMs = 15000) {
  const startMs = start?.getTime()
  const [mount] = useState(() => Date.now())
  const [tick, setTick] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), stepMs)
    return () => clearInterval(id)
  }, [stepMs])
  return new Date((startMs ?? mount) + (tick - mount))
}

/** Largeur réelle du conteneur : le SVG est dessiné en px vrais, le texte ne se déforme jamais. */
export function useWidth<T extends HTMLElement>(fallback = 560) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    setWidth(node.clientWidth || fallback)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(Math.round(w))
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [fallback])
  return [ref, width] as const
}

/** Pastille de statut (texte + point), jamais la couleur seule. */
export function StatusPill({
  tone = 'neutral',
  pulse,
  children,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'reward' | 'solar'
  pulse?: boolean
  children: ReactNode
}) {
  const dot = {
    neutral: 'bg-ink-muted',
    success: 'bg-success',
    warning: 'bg-warning',
    reward: 'bg-reward',
    solar: 'bg-solar',
  }[tone]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink">
      <span className="relative inline-flex size-2">
        {pulse && (
          <span
            className={cx(
              'absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden',
              dot
            )}
          />
        )}
        <span className={cx('relative inline-flex size-2 rounded-full', dot)} />
      </span>
      {children}
    </span>
  )
}

/** Bouton segmenté (aria-pressed). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T
  options: { id: T; label: ReactNode }[]
  onChange: (v: T) => void
  label: string
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx('inline-flex rounded-full border border-line bg-surface p-0.5', className)}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
            value === o.id ? 'bg-primary text-primary-contrast' : 'text-ink-muted hover:text-ink'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cx('size-3.5', className)} aria-hidden>
      <path
        d="M5 7V5.2a3 3 0 0 1 6 0V7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect x="3.2" y="7" width="9.6" height="7" rx="2" fill="currentColor" />
    </svg>
  )
}
