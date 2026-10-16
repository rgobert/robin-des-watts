import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AnimatedNumber } from '../components/animated_number'
import { duration, ease, spring } from '../motion'
import { cx } from '../utils'
import { focusRing } from './shared'

export type FilterOption = {
  value: string
  label: string
  count?: number
  tone?: 'danger' | 'warning' | 'success'
}
export type FilterDef = { id: string; label: string; options: FilterOption[] }
export type FilterValue = Record<string, string[]>

type Labels = {
  clearAll: string
  results: (n: number, total?: number) => ReactNode
  remove: (label: string) => string
}

const DEFAULT_LABELS: Labels = {
  clearAll: 'Tout effacer',
  results: (n, total) => (
    <>
      <AnimatedNumber value={n} className="font-semibold text-ink" />{' '}
      {n > 1 ? 'résultats' : 'résultat'}
      {total !== undefined && total !== n && <span className="text-ink-muted"> sur {total}</span>}
    </>
  ),
  remove: (l) => `Retirer le filtre ${l}`,
}

/** Applique un `FilterValue` à une liste. `get(row, filterId)` renvoie la valeur de la ligne pour ce filtre. */
export function applyFilters<T>(
  rows: T[],
  value: FilterValue,
  get: (row: T, filterId: string) => string | string[]
) {
  const active = Object.entries(value).filter(([, v]) => v.length)
  if (!active.length) return rows
  return rows.filter((r) =>
    active.every(([id, vals]) => {
      const got = get(r, id)
      return Array.isArray(got) ? got.some((g) => vals.includes(g)) : vals.includes(got)
    })
  )
}

/**
 * Barre de filtres : menus à cases (clavier ↑ ↓ Espace Échap), chips des filtres actifs retirables, « Tout effacer »,
 * compteur de résultats animé. `children` reçoit une zone libre (recherche, vues enregistrées…).
 * Friction traitée : « pourquoi je ne vois que 4 dossiers ? » ; les filtres actifs restent visibles et se retirent en un clic.
 */
export function FilterBar({
  filters,
  value,
  onChange,
  resultCount,
  totalCount,
  presets,
  labels: labelsProp,
  children,
  className,
}: {
  filters: FilterDef[]
  value: FilterValue
  onChange: (v: FilterValue) => void
  resultCount: number
  totalCount?: number
  /** Raccourcis de filtres en un clic, ex. « En retard ». */
  presets?: { id: string; label: string; value: FilterValue; tone?: 'danger' | 'warning' }[]
  labels?: Partial<Labels>
  children?: ReactNode
  className?: string
}) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp }
  const chips = filters.flatMap((f) =>
    (value[f.id] ?? []).map((v) => ({
      filter: f,
      option: f.options.find((o) => o.value === v) ?? { value: v, label: v },
    }))
  )
  const toggle = (fid: string, v: string) => {
    const cur = value[fid] ?? []
    onChange({ ...value, [fid]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] })
  }
  const same = (a: FilterValue, b: FilterValue) => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    return [...keys].every((k) => {
      const x = [...(a[k] ?? [])].sort().join('|')
      const y = [...(b[k] ?? [])].sort().join('|')
      return x === y
    })
  }

  return (
    <div className={cx('space-y-2.5', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <FilterMenu
            key={f.id}
            def={f}
            selected={value[f.id] ?? []}
            onToggle={(v) => toggle(f.id, v)}
            onClear={() => onChange({ ...value, [f.id]: [] })}
          />
        ))}
        {presets?.map((p) => {
          const on = same(value, p.value)
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? {} : p.value)}
              className={cx(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors',
                on
                  ? 'border-transparent bg-ink text-canvas'
                  : 'border-dashed border-line text-ink-muted hover:border-ink/30 hover:text-ink',
                focusRing
              )}
            >
              {p.tone && (
                <span
                  className={cx(
                    'size-1.5 rounded-full',
                    p.tone === 'danger' ? 'bg-danger' : 'bg-warning'
                  )}
                />
              )}
              {p.label}
            </button>
          )
        })}
        {children}
        <p className="ml-auto text-sm whitespace-nowrap text-ink-muted" aria-live="polite">
          {labels.results(resultCount, totalCount)}
        </p>
      </div>

      <AnimatePresence initial={false}>
        {chips.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: duration.base, ease: ease.out }}
            className="overflow-hidden"
          >
            <ul className="flex flex-wrap items-center gap-1.5" aria-label="Filtres actifs">
              <AnimatePresence initial={false} mode="popLayout">
                {chips.map(({ filter, option }) => (
                  <motion.li
                    key={`${filter.id}:${option.value}`}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: duration.fast } }}
                    transition={spring}
                    className="inline-flex h-7 items-center gap-1 rounded-full bg-primary/[0.08] pr-1 pl-2.5 text-xs text-ink"
                  >
                    <span className="text-ink-muted">{filter.label} :</span>
                    <span className="font-medium">{option.label}</span>
                    <button
                      type="button"
                      onClick={() => toggle(filter.id, option.value)}
                      aria-label={labels.remove(`${filter.label} ${option.label}`)}
                      className={cx(
                        'ml-0.5 grid size-6 place-items-center rounded-full text-ink-muted hover:bg-primary/10 hover:text-ink',
                        focusRing
                      )}
                    >
                      <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden>
                        <path
                          d="M2 2l8 8M10 2l-8 8"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </motion.li>
                ))}
                <motion.li key="__clear" layout transition={spring}>
                  <button
                    type="button"
                    onClick={() => onChange({})}
                    className={cx(
                      'h-7 rounded-full px-2 text-xs font-semibold text-primary hover:underline',
                      focusRing
                    )}
                  >
                    {labels.clearAll}
                  </button>
                </motion.li>
              </AnimatePresence>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FilterMenu({
  def,
  selected,
  onToggle,
  onClear,
}: {
  def: FilterDef
  selected: string[]
  onToggle: (v: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const btn = useRef<HTMLButtonElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const items = useRef<Array<HTMLButtonElement | null>>([])
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  useEffect(() => {
    if (open) items.current[active]?.focus()
  }, [open, active])

  const close = () => {
    setOpen(false)
    btn.current?.focus()
  }

  const n = selected.length
  // « Effacer ce filtre » fait partie de la navigation ↑ ↓, en dernière position (index options.length).
  const count = def.options.length + (n > 0 ? 1 : 0)
  return (
    <div ref={root} className="relative">
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setActive(0)
          setOpen((o) => !o)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive(0)
            setOpen(true)
          }
        }}
        className={cx(
          'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors',
          n
            ? 'border-primary/40 bg-primary/[0.06] text-ink'
            : 'border-line bg-surface text-ink hover:border-ink/30',
          focusRing
        )}
      >
        {def.label}
        {n > 0 && (
          <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-contrast tabular-nums">
            {n}
          </span>
        )}
        <motion.svg
          viewBox="0 0 12 12"
          className="size-3 text-ink-muted"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: duration.fast }}
          aria-hidden
        >
          <path
            d="M2 4.5l4 3.5 4-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </motion.svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            role="menu"
            aria-label={def.label}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: duration.instant } }}
            transition={{ duration: duration.fast, ease: ease.out }}
            style={{ transformOrigin: 'top left' }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => (a + 1) % count)
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => (a - 1 + count) % count)
              } else if (e.key === 'Home') {
                e.preventDefault()
                setActive(0)
              } else if (e.key === 'End') {
                e.preventDefault()
                setActive(count - 1)
              } else if (e.key === 'Escape' || e.key === 'Tab') {
                e.preventDefault()
                close()
              }
            }}
            className="absolute top-full left-0 z-30 mt-1.5 w-60 rounded-md border border-line bg-surface p-1 shadow-card"
          >
            {def.options.map((o, i) => {
              const on = selected.includes(o.value)
              return (
                <button
                  key={o.value}
                  ref={(el) => {
                    items.current[i] = el
                  }}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  tabIndex={i === active ? 0 : -1}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => onToggle(o.value)}
                  className="flex min-h-9 w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-sm text-ink outline-none focus:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                >
                  <span
                    className={cx(
                      'grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors',
                      on
                        ? 'border-primary bg-primary text-primary-contrast'
                        : 'border-line bg-surface'
                    )}
                  >
                    {on && (
                      <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
                        <path
                          d="M3.5 8.5l3 3 6-7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  {o.tone && (
                    <span
                      className={cx(
                        'size-1.5 shrink-0 rounded-full',
                        o.tone === 'danger'
                          ? 'bg-danger'
                          : o.tone === 'warning'
                            ? 'bg-warning'
                            : 'bg-success'
                      )}
                    />
                  )}
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.count !== undefined && (
                    <span className="text-xs text-ink-muted tabular-nums">{o.count}</span>
                  )}
                </button>
              )
            })}
            {selected.length > 0 && (
              <div className="mt-1 border-t border-line pt-1">
                <button
                  ref={(el) => {
                    items.current[def.options.length] = el
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={active === def.options.length ? 0 : -1}
                  onMouseEnter={() => setActive(def.options.length)}
                  onClick={() => {
                    onClear()
                    close()
                  }}
                  className="min-h-9 w-full rounded-sm px-2 py-1.5 text-left text-xs font-medium text-primary outline-none hover:bg-surface-2 focus:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                >
                  Effacer ce filtre
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
