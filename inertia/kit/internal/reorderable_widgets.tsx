import { motion, useReducedMotion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { spring } from '../motion'
import { cx } from '../utils'

export type Widget = { id: string; label: string; node: ReactNode }

const read = (key: string): string[] | null => {
  try {
    const raw = window.localStorage.getItem(key)
    const v = raw ? JSON.parse(raw) : null
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : null
  } catch {
    return null
  }
}
const write = (key: string, ids: string[] | null) => {
  try {
    if (ids) window.localStorage.setItem(key, JSON.stringify(ids))
    else window.localStorage.removeItem(key)
  } catch {
    /* stockage indisponible : l'ordre reste en mémoire */
  }
}
/** Garde l'ordre mémorisé, ajoute les nouveaux widgets à la fin, oublie ceux qui ont disparu. */
const merge = (saved: string[] | null, ids: string[]) =>
  saved
    ? [...saved.filter((id) => ids.includes(id)), ...ids.filter((id) => !saved.includes(id))]
    : ids

const COLS = {
  2: 'grid-cols-1 min-[420px]:grid-cols-2',
  3: 'grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4',
} as const

/**
 * Widgets réordonnables (accueil de KPI à la Stripe) : mode « Réorganiser », glisser-déposer ou flèches,
 * ordre gardé dans le navigateur (localStorage, avec repli en mémoire).
 * Friction traitée : chaque équipe (finance, ops, produit) regarde d'abord ses 2 chiffres ; un ordre imposé
 * les oblige à chercher. Ici chacun met en tête ce qui compte pour lui, sans toucher au code.
 * Pattern : P20 (Stripe Dashboard, widgets ajoutables et réordonnables).
 */
export function ReorderableWidgets({
  widgets,
  storageKey,
  cols = 3,
  editLabel = 'Réorganiser',
  doneLabel = 'Terminé',
  resetLabel = 'Ordre par défaut',
  hint = 'Glissez un widget ou utilisez les flèches.',
  className,
}: {
  widgets: Widget[]
  /** Clé localStorage (une par tableau de bord). */
  storageKey: string
  cols?: keyof typeof COLS
  editLabel?: string
  doneLabel?: string
  resetLabel?: string
  hint?: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const ids = widgets.map((w) => w.id)
  const idKey = ids.join('|')
  const [order, setOrder] = useState<string[]>(() => merge(read(storageKey), ids))
  const [editing, setEditing] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')

  const [prevIdKey, setPrevIdKey] = useState(idKey)
  if (idKey !== prevIdKey) {
    setPrevIdKey(idKey)
    setOrder((o) => merge(o, ids))
  }

  const byId = new Map(widgets.map((w) => [w.id, w]))
  const commit = (next: string[], moved?: string) => {
    setOrder(next)
    write(storageKey, next)
    if (moved)
      setAnnounce(
        `${byId.get(moved)?.label} en position ${next.indexOf(moved) + 1} sur ${next.length}.`
      )
  }
  const move = (id: string, delta: number, from?: HTMLButtonElement) => {
    const i = order.indexOf(id)
    const j = i + delta
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    commit(next, id)
    // arrivé en bout de ligne, la flèche se désactive : on garde le focus sur l'autre flèche plutôt que de le perdre
    if (from)
      setTimeout(() => {
        if (from.disabled)
          from.parentElement?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
      }, 0)
  }
  const dropOn = (target: string) => {
    if (!dragging || dragging === target) return
    const next = order.filter((x) => x !== dragging)
    next.splice(
      next.indexOf(target) + (order.indexOf(dragging) < order.indexOf(target) ? 1 : 0),
      0,
      dragging
    )
    commit(next, dragging)
  }

  return (
    <div className={cx('min-w-0', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        {editing && <p className="mr-auto text-xs text-ink-muted">{hint}</p>}
        {editing && (
          <button
            type="button"
            onClick={() => {
              write(storageKey, null)
              setOrder(ids)
              setAnnounce('Ordre par défaut rétabli.')
            }}
            className="rounded-full px-3 py-1.5 text-sm text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
          >
            {resetLabel}
          </button>
        )}
        <button
          type="button"
          aria-pressed={editing}
          onClick={() => setEditing((e) => !e)}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary',
            editing
              ? 'border-primary bg-primary text-primary-contrast'
              : 'border-line bg-surface text-ink hover:border-ink-muted'
          )}
        >
          <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden>
            {[4, 8, 12].flatMap((y) =>
              [5.5, 10.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" />)
            )}
          </svg>
          {editing ? doneLabel : editLabel}
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <div className={cx('grid gap-4', COLS[cols])}>
        {order.map((id, i) => {
          const w = byId.get(id)
          if (!w) return null
          return (
            <motion.div
              key={id}
              layout={reduce ? false : 'position'}
              transition={spring}
              className="h-full min-w-0"
            >
              <div
                draggable={editing}
                onDragStart={(e) => {
                  setDragging(id)
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', id)
                }}
                onDragEnd={() => setDragging(null)}
                onDragOver={(e) => {
                  if (editing && dragging) e.preventDefault()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  dropOn(id)
                  setDragging(null)
                }}
                className={cx(
                  'relative h-full min-w-0 rounded-md',
                  editing && 'cursor-grab outline-1 outline-offset-2 outline-line outline-dashed',
                  dragging === id && 'opacity-40'
                )}
              >
                {w.node}
                {editing && (
                  <div className="absolute top-2 right-2 flex gap-1 rounded-full border border-line bg-surface p-0.5 shadow-card">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={(e) => move(id, -1, e.currentTarget)}
                      aria-label={`Déplacer ${w.label} avant`}
                      className="rounded-full p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-30"
                    >
                      <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                        <path
                          d="M7.5 2.5 4 6l3.5 3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      disabled={i === order.length - 1}
                      onClick={(e) => move(id, 1, e.currentTarget)}
                      aria-label={`Déplacer ${w.label} après`}
                      className="rounded-full p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-30"
                    >
                      <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                        <path
                          d="M4.5 2.5 8 6 4.5 9.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
