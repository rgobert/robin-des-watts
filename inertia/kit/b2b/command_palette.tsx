import { AnimatePresence, motion } from 'motion/react'
import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { duration, ease } from '../motion'
import { cx } from '../utils'
import { KeyboardHint } from './keyboard_hint'
import { focusRing, fuzzyMatch, isTypingTarget, matchesShortcut, normalize } from './shared'

export type CommandItem = {
  id: string
  label: string
  /** Nom du groupe : « Actions », « Dossiers », « Aide »… L'ordre d'apparition fait l'ordre des groupes. */
  group: string
  description?: string
  /** Mots-clés cachés pour la recherche (synonymes, référence…). */
  keywords?: string[]
  /** Raccourci affiché ET actif quand la palette est fermée, ex. `['N']`, `['mod', 'shift', 'E']`. */
  shortcut?: string[]
  icon?: ReactNode
  onSelect: () => void
}

type Labels = {
  placeholder: string
  empty: (q: string) => string
  trigger: string
  navigate: string
  open: string
  close: string
  title: string
}

const DEFAULT_LABELS: Labels = {
  placeholder: 'Rechercher un dossier, une action…',
  empty: (q) => `Rien ne correspond à « ${q} »`,
  trigger: 'Rechercher ou agir…',
  navigate: 'naviguer',
  open: 'ouvrir',
  close: 'fermer',
  title: 'Palette de commandes',
}

type Scored = { item: CommandItem; score: number; indices: number[] }

/**
 * Palette de commandes (⌘K / Ctrl+K) : recherche floue sans accents sur actions et dossiers, groupes, raccourcis
 * affichés (et actifs), navigation ↑ ↓ + Entrée, Échap pour fermer, focus restitué.
 * Contrôlée (`open` + `onOpenChange`) ou autonome avec son bouton déclencheur (`showTrigger`).
 * Friction traitée : 4 clics et 2 menus pour ouvrir un dossier ou lancer une relance ; ici, 3 lettres et Entrée.
 */
export function CommandPalette({
  items,
  open: openProp,
  onOpenChange,
  hotkey = ['mod', 'K'],
  bindItemShortcuts = true,
  showTrigger = true,
  maxPerGroup = 5,
  labels: labelsProp,
  triggerClassName,
}: {
  items: CommandItem[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hotkey?: string[]
  bindItemShortcuts?: boolean
  showTrigger?: boolean
  /** Nombre d'éléments par groupe quand la recherche est vide. */
  maxPerGroup?: number
  labels?: Partial<Labels>
  triggerClassName?: string
}) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp }
  const [innerOpen, setInnerOpen] = useState(false)
  const open = openProp ?? innerOpen
  const setOpen = (o: boolean) => {
    if (openProp === undefined) setInnerOpen(o)
    onOpenChange?.(o)
  }
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)
  const listId = useId()

  // À l'ouverture : recherche vide, premier résultat actif.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setQ('')
      setActive(0)
    }
  }

  // Référence stable vers l'état courant pour les écouteurs globaux.
  const live = useRef({ open, items, setOpen })
  useLayoutEffect(() => {
    live.current = { open, items, setOpen }
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { open: isOpen, items: its, setOpen: so } = live.current
      if (matchesShortcut(e, hotkey)) {
        e.preventDefault()
        so(!isOpen)
        return
      }
      if (isOpen || !bindItemShortcuts || e.repeat) return
      for (const it of its) {
        if (!it.shortcut) continue
        const needsMod = it.shortcut.some((k) =>
          ['mod', 'ctrl', 'meta', 'alt'].includes(k.toLowerCase())
        )
        if (!needsMod && isTypingTarget(e.target)) continue
        if (matchesShortcut(e, it.shortcut)) {
          e.preventDefault()
          it.onSelect()
          return
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hotkey, bindItemShortcuts])

  // Ouverture : mémorise le focus, bloque le défilement de la page.
  useEffect(() => {
    if (!open) return
    restoreFocus.current = document.activeElement as HTMLElement | null
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = requestAnimationFrame(() => inputRef.current?.focus())
    return () => {
      cancelAnimationFrame(t)
      document.body.style.overflow = prev
      restoreFocus.current?.focus?.({ preventScroll: true })
    }
  }, [open])

  const groups = useMemo(() => {
    const scored: Scored[] = []
    for (const item of items) {
      if (!q.trim()) {
        scored.push({ item, score: 0, indices: [] })
        continue
      }
      const onLabel = fuzzyMatch(q, item.label)
      const onKw = item.keywords?.map((k) => fuzzyMatch(q, k)).find(Boolean) ?? null
      const onDesc =
        item.description && normalize(item.description).includes(normalize(q))
          ? fuzzyMatch(q, item.description)
          : null
      const score = Math.max(
        onLabel?.score ?? -1,
        (onKw?.score ?? -1) * 0.85,
        (onDesc?.score ?? -1) * 0.6
      )
      if (score < 0) continue
      scored.push({ item, score, indices: onLabel?.indices ?? [] })
    }
    const map = new Map<string, Scored[]>()
    for (const s of scored) map.set(s.item.group, [...(map.get(s.item.group) ?? []), s])
    let out = [...map.entries()].map(([name, list]) => ({
      name,
      list: q.trim() ? list.sort((a, b) => b.score - a.score) : list.slice(0, maxPerGroup),
      best: Math.max(...list.map((l) => l.score)),
    }))
    if (q.trim())
      out = out.sort((a, b) => b.best - a.best).map((g) => ({ ...g, list: g.list.slice(0, 8) }))
    return out
  }, [items, q, maxPerGroup])

  const flat = groups.flatMap((g) => g.list)
  const activeIdx = Math.min(active, Math.max(0, flat.length - 1))
  const optionId = (i: number) => `${listId}-opt-${i}`

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIdx}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const run = (s?: Scored) => {
    if (!s) return
    setOpen(false)
    // Laisse la palette se fermer et le focus revenir avant l'action (qui peut défiler ou ouvrir autre chose).
    setTimeout(() => s.item.onSelect(), 30)
  }

  let counter = -1

  return (
    <>
      {showTrigger && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className={cx(
            'inline-flex h-10 w-full max-w-xs items-center gap-2 rounded-full border border-line bg-surface pr-2 pl-3.5 text-sm text-ink-muted transition-colors hover:border-ink/30 hover:text-ink',
            focusRing,
            triggerClassName
          )}
        >
          <SearchIcon />
          <span className="flex-1 truncate text-left">{labels.trigger}</span>
          <KeyboardHint keys={hotkey} />
        </button>
      )}

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                key="cp"
                className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[12vh] sm:px-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: duration.fast } }}
              >
                <div
                  className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
                  onClick={() => setOpen(false)}
                  aria-hidden
                />
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-label={labels.title}
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: duration.fast } }}
                  transition={{ duration: duration.base, ease: ease.out }}
                  className="relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setOpen(false)
                    } else if (e.key === 'Tab') {
                      // Le seul élément focusable est le champ : on garde le focus dans la palette.
                      e.preventDefault()
                    }
                  }}
                >
                  <div className="flex items-center gap-2.5 border-b border-line px-4">
                    <SearchIcon />
                    <input
                      ref={inputRef}
                      role="combobox"
                      aria-expanded="true"
                      aria-controls={listId}
                      aria-autocomplete="list"
                      aria-activedescendant={flat.length ? optionId(activeIdx) : undefined}
                      value={q}
                      onChange={(e) => {
                        setQ(e.target.value)
                        setActive(0)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          setActive((a) =>
                            flat.length ? (Math.min(a, flat.length - 1) + 1) % flat.length : 0
                          )
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          setActive((a) =>
                            flat.length
                              ? (Math.min(a, flat.length - 1) - 1 + flat.length) % flat.length
                              : 0
                          )
                        } else if (e.key === 'Enter') {
                          e.preventDefault()
                          run(flat[activeIdx])
                        }
                      }}
                      placeholder={labels.placeholder}
                      className="h-13 min-w-0 flex-1 bg-transparent py-4 text-base text-ink placeholder:text-ink-muted/80 focus:outline-none"
                    />
                    <KeyboardHint keys="esc" className="hidden sm:inline-flex" />
                  </div>

                  <div
                    ref={listRef}
                    id={listId}
                    role="listbox"
                    aria-label={labels.title}
                    className="flex-1 overflow-y-auto overscroll-contain p-1.5"
                  >
                    {flat.length === 0 && (
                      <div className="px-4 py-10 text-center">
                        <p className="text-sm font-medium text-ink">{labels.empty(q)}</p>
                        <p className="mt-1 text-sm text-ink-muted">
                          Essayez un nom de client, une commune ou « relancer ».
                        </p>
                      </div>
                    )}
                    {groups.map((g) => (
                      <Fragment key={g.name}>
                        <div
                          role="presentation"
                          className="px-2.5 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide text-ink-muted uppercase"
                        >
                          {g.name}
                        </div>
                        {g.list.map((s) => {
                          counter++
                          const i = counter
                          const on = i === activeIdx
                          return (
                            <div
                              key={s.item.id}
                              id={optionId(i)}
                              role="option"
                              aria-selected={on}
                              data-index={i}
                              onMouseMove={() => active !== i && setActive(i)}
                              onClick={() => run(s)}
                              className={cx(
                                'relative flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2',
                                on ? 'text-ink' : 'text-ink'
                              )}
                            >
                              {on && (
                                <motion.span
                                  layoutId="cp-active"
                                  className="absolute inset-0 rounded-md bg-surface-2"
                                  transition={{ duration: duration.fast, ease: ease.out }}
                                />
                              )}
                              <span className="relative grid size-7 shrink-0 place-items-center rounded-sm border border-line bg-surface text-ink-muted">
                                {s.item.icon ?? <DotIcon />}
                              </span>
                              <span className="relative min-w-0 flex-1">
                                <span className="block truncate text-sm">
                                  <Highlight text={s.item.label} indices={s.indices} />
                                </span>
                                {s.item.description && (
                                  <span className="block truncate text-xs text-ink-muted">
                                    {s.item.description}
                                  </span>
                                )}
                              </span>
                              {s.item.shortcut && (
                                <KeyboardHint keys={s.item.shortcut} className="relative" />
                              )}
                              {on && !s.item.shortcut && (
                                <KeyboardHint keys="enter" tone="subtle" className="relative" />
                              )}
                            </div>
                          )
                        })}
                      </Fragment>
                    ))}
                  </div>

                  <div className="hidden items-center gap-4 border-t border-line bg-canvas/60 px-4 py-2 text-xs text-ink-muted sm:flex">
                    <span className="inline-flex items-center gap-1.5">
                      <KeyboardHint keys={['up']} size="xs" />
                      <KeyboardHint keys={['down']} size="xs" />
                      {labels.navigate}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <KeyboardHint keys="enter" size="xs" /> {labels.open}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <KeyboardHint keys="esc" size="xs" /> {labels.close}
                    </span>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  )
}

function Highlight({ text, indices }: { text: string; indices: number[] }) {
  if (!indices.length) return <>{text}</>
  const set = new Set(indices)
  return (
    <>
      {[...text].map((ch, i) =>
        set.has(i) ? (
          <mark key={i} className="bg-transparent font-semibold text-primary">
            {ch}
          </mark>
        ) : (
          <Fragment key={i}>{ch}</Fragment>
        )
      )}
    </>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-ink-muted" aria-hidden>
      <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function DotIcon() {
  return <span className="size-1.5 rounded-full bg-current" aria-hidden />
}
