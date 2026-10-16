import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useToast } from '../components/toast'
import { duration } from '../motion'
import { cx } from '../utils'
import { KeyboardHint } from './keyboard_hint'
import { focusRing } from './shared'

type Labels = {
  edit: (label: string) => string
  saved: (label: string) => string
  undo: string
  restored: (label: string) => string
  failed: string
  empty: string
}

const DEFAULT_LABELS: Labels = {
  edit: (l) => `Modifier ${l.toLowerCase()}`,
  saved: (l) => `${l} mis à jour`,
  undo: 'Annuler',
  restored: (l) => `${l} restauré`,
  failed: 'Échec de l’enregistrement, valeur restaurée',
  empty: 'Ajouter',
}

/**
 * Champ éditable sur place : clic ou Entrée pour éditer, Entrée (ou clic ailleurs) pour enregistrer, Échap pour annuler.
 * Sauvegarde optimiste (la valeur change tout de suite), toast « Annuler » pendant 5 s, retour arrière si l'appel échoue.
 * Friction traitée : ouvrir un formulaire d'édition complet pour corriger un numéro de téléphone.
 */
export function InlineEdit({
  value,
  onSave,
  label,
  type = 'text',
  validate,
  placeholder,
  format,
  suffix,
  undoable = true,
  labels: labelsProp,
  className,
}: {
  value: string
  /** Peut renvoyer une promesse : si elle échoue, la valeur précédente revient. */
  onSave: (next: string) => void | Promise<void>
  /** Nom du champ, ex. « Téléphone ». Sert à l'accessibilité et aux toasts. */
  label: string
  type?: 'text' | 'tel' | 'email' | 'number'
  validate?: (v: string) => string | null
  placeholder?: string
  /** Affichage hors édition (ex. formatage du numéro). */
  format?: (v: string) => ReactNode
  suffix?: string
  undoable?: boolean
  labels?: Partial<Labels>
  className?: string
}) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp }
  const toast = useToast()
  const [current, setCurrent] = useState(value)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const errId = useId()

  // Suit la valeur externe (ex. modifiée ailleurs dans l'app).
  const lastProp = useRef(value)
  useEffect(() => {
    if (lastProp.current === value) return
    lastProp.current = value
    setCurrent(value)
  }, [value])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const closed = useRef(false)
  const start = () => {
    closed.current = false
    setDraft(current)
    setError(null)
    setEditing(true)
  }

  const cancel = () => {
    closed.current = true
    setEditing(false)
    setError(null)
    requestAnimationFrame(() => btnRef.current?.focus())
  }

  const persist = async (next: string, prev: string, withUndo: boolean) => {
    setCurrent(next)
    setFlash((f) => f + 1)
    try {
      await onSave(next)
      if (withUndo && undoable) {
        toast({
          message: labels.saved(label),
          actionLabel: labels.undo,
          tone: 'success',
          onAction: () =>
            persist(prev, next, false).then(() =>
              toast({ message: labels.restored(label), duration: 2500 })
            ),
        })
      }
    } catch {
      setCurrent(prev)
      toast({ message: labels.failed })
    }
  }

  const commit = (refocus: boolean) => {
    const next = draft.trim()
    const err = validate?.(next) ?? null
    if (err) {
      setError(err)
      inputRef.current?.focus()
      return
    }
    closed.current = true
    setEditing(false)
    if (refocus) requestAnimationFrame(() => btnRef.current?.focus())
    if (next !== current) persist(next, current, true)
  }

  return (
    <span className={cx('relative inline-flex max-w-full min-w-0 align-middle', className)}>
      {editing ? (
        <span className="inline-flex w-full flex-col">
          <span className="relative inline-flex items-center">
            <input
              ref={inputRef}
              type={type === 'number' ? 'text' : type}
              inputMode={type === 'number' ? 'decimal' : type === 'tel' ? 'tel' : undefined}
              value={draft}
              placeholder={placeholder}
              aria-label={label}
              aria-invalid={!!error}
              aria-describedby={error ? errId : undefined}
              onChange={(e) => {
                setDraft(e.target.value)
                if (error) setError(validate?.(e.target.value.trim()) ?? null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commit(true)
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  e.stopPropagation()
                  cancel()
                }
              }}
              onBlur={() => {
                if (closed.current) return
                // Saisie invalide : on garde le champ ouvert avec l'erreur visible, plutôt que de jeter la saisie en silence.
                const err = validate?.(draft.trim()) ?? null
                if (err) setError(err)
                else commit(false)
              }}
              className={cx(
                '-mx-1.5 -my-1 h-8 w-full min-w-40 rounded-sm border bg-surface px-1.5 text-sm text-ink focus:ring-2 focus:outline-none',
                error
                  ? 'border-danger focus:ring-danger/20'
                  : 'border-primary focus:ring-primary/15',
                suffix && 'pr-12'
              )}
            />
            {suffix && (
              <span className="pointer-events-none absolute right-1 text-xs text-ink-muted">
                {suffix}
              </span>
            )}
          </span>
          <span className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-muted">
            {error ? (
              <span id={errId} className="font-medium text-danger">
                {error}
              </span>
            ) : (
              <>
                <span className="inline-flex items-center gap-1">
                  <KeyboardHint keys="enter" size="xs" /> enregistrer
                </span>
                <span className="inline-flex items-center gap-1">
                  <KeyboardHint keys="esc" size="xs" /> annuler
                </span>
              </>
            )}
          </span>
        </span>
      ) : (
        <button
          ref={btnRef}
          type="button"
          onClick={start}
          aria-label={`${labels.edit(label)} : ${current || 'vide'}`}
          className={cx(
            'group relative -mx-1.5 -my-1 inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-1 text-left text-sm text-ink transition-colors hover:bg-surface-2',
            focusRing
          )}
        >
          <AnimatePresence>
            {flash > 0 && (
              <motion.span
                key={flash}
                aria-hidden
                className="absolute inset-0 rounded-sm bg-success/15"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: duration.story, delay: 0.2 }}
              />
            )}
          </AnimatePresence>
          <span className={cx('relative truncate', !current && 'text-ink-muted')}>
            {current ? (format ? format(current) : current) : (placeholder ?? labels.empty)}
            {current && suffix && <span className="text-ink-muted"> {suffix}</span>}
          </span>
          <svg
            viewBox="0 0 16 16"
            className="relative size-3.5 shrink-0 text-ink-muted opacity-50 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            aria-hidden
          >
            <path
              d="M10.8 2.7l2.5 2.5L6 12.5l-3.2.7.7-3.2z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </span>
  )
}
