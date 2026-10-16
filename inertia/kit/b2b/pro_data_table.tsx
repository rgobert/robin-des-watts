import { AnimatePresence, motion } from 'motion/react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { Skeleton } from '../components/skeleton'
import { duration, ease, spring } from '../motion'
import { cx } from '../utils'
import { KeyboardHint } from './keyboard_hint'
import { focusRing, isTypingTarget, normalize, plural } from './shared'

export type ProColumn<T> = {
  id: string
  header: string
  /** Valeur brute : sert au tri et à la recherche. */
  accessor: (row: T) => string | number | null | undefined
  /** Rendu de la cellule. Par défaut : la valeur brute. */
  cell?: (row: T) => ReactNode
  sortable?: boolean
  /** Inclus dans la recherche texte (vrai par défaut). */
  searchable?: boolean
  align?: 'left' | 'right' | 'center'
  /** Classe de largeur, ex. `w-28`. */
  width?: string
  /** Masquée sous 640 px (la table reste lisible sur chantier). */
  hideOnMobile?: boolean
  /** Masquée sous 1024 px (tablette) : réserver aux colonnes secondaires. */
  hideOnTablet?: boolean
}

export type ProBulkAction<T> = {
  id: string
  label: string
  onRun: (rows: T[]) => void
  tone?: 'default' | 'danger'
  icon?: ReactNode
}

export type ProSort = { id: string; dir: 'asc' | 'desc' } | null
export type ProDensity = 'comfortable' | 'compact'

type Labels = {
  search: string
  selected: (n: number) => string
  clearSelection: string
  selectAll: string
  selectRow: string
  noResults: (q: string) => string
  clearSearch: string
  comfortable: string
  compact: string
  loading: string
  bulkBar: string
}

const DEFAULT_LABELS: Labels = {
  search: 'Rechercher un client, une commune…',
  selected: (n) => `${plural(n, 'sélectionné', 'sélectionnés')}`,
  clearSelection: 'Tout désélectionner',
  selectAll: 'Sélectionner toutes les lignes visibles',
  selectRow: 'Sélectionner la ligne',
  noResults: (q) => `Aucun résultat pour « ${q} »`,
  clearSearch: 'Effacer la recherche',
  comfortable: 'Confortable',
  compact: 'Compacte',
  loading: 'Chargement des données',
  bulkBar: 'Actions groupées',
}

type Props<T> = {
  rows: T[]
  columns: ProColumn<T>[]
  getRowId: (row: T) => string
  /** Libellé lu par les lecteurs d'écran pour une ligne (ex. le nom du client). */
  getRowLabel?: (row: T) => string
  loading?: boolean
  skeletonRows?: number
  onRowClick?: (row: T) => void
  /** Ligne mise en avant (ex. dossier ouvert à côté). */
  activeRowId?: string
  selectable?: boolean
  bulkActions?: ProBulkAction<T>[]
  searchable?: boolean
  /** Recherche contrôlée (optionnel). */
  search?: string
  onSearchChange?: (q: string) => void
  /** « / » place le curseur dans la recherche (vrai par défaut). */
  searchHotkey?: boolean
  initialSort?: ProSort
  density?: ProDensity
  onDensityChange?: (d: ProDensity) => void
  showDensityToggle?: boolean
  /** Signal visuel sur la ligne (barre à gauche) : retard, alerte. */
  rowTone?: (row: T) => 'danger' | 'warning' | undefined
  /** Contenu quand `rows` est vide (pas de recherche en cours). */
  empty?: ReactNode
  /** Éléments ajoutés à droite de la recherche (filtres, bouton d'export…). */
  toolbar?: ReactNode
  /** Hauteur max de la zone défilante ; l'en-tête reste collé. */
  maxHeight?: string
  caption?: string
  /** Nombre de lignes visibles après recherche (pour un compteur externe, ex. FilterBar). */
  onVisibleCountChange?: (n: number) => void
  labels?: Partial<Labels>
  className?: string
}

/**
 * Table de données pro, générique et typée : tri, recherche sans accents, sélection multiple (Maj+clic pour une plage)
 * avec barre d'actions groupées qui glisse depuis le bas, ligne cliquable, skeleton, état vide utile, densité, clavier
 * (↑ ↓ pour naviguer, Entrée pour ouvrir, Espace pour sélectionner, Échap pour désélectionner, « / » pour chercher).
 * Friction traitée : ouvrir 18 dossiers un par un pour trouver celui qui bloque, et refaire 5 fois la même action.
 */
export function ProDataTable<T>({
  rows,
  columns,
  getRowId,
  getRowLabel,
  loading = false,
  skeletonRows = 6,
  onRowClick,
  activeRowId,
  selectable = false,
  bulkActions = [],
  searchable = true,
  search,
  onSearchChange,
  searchHotkey = true,
  initialSort = null,
  density: densityProp,
  onDensityChange,
  showDensityToggle = true,
  rowTone,
  empty,
  toolbar,
  maxHeight = '34rem',
  caption,
  onVisibleCountChange,
  labels: labelsProp,
  className,
}: Props<T>) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp }
  const [innerSearch, setInnerSearch] = useState('')
  const q = search ?? innerSearch
  const setQ = (v: string) => (onSearchChange ? onSearchChange(v) : setInnerSearch(v))
  const [sort, setSort] = useState<ProSort>(initialSort)
  const [innerDensity, setInnerDensity] = useState<ProDensity>('comfortable')
  const density = densityProp ?? innerDensity
  const setDensity = (d: ProDensity) => (onDensityChange ? onDensityChange(d) : setInnerDensity(d))
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [focusIdx, setFocusIdx] = useState(0)
  const anchor = useRef<number | null>(null)
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([])
  const searchRef = useRef<HTMLInputElement>(null)

  // Recherche : chaque mot doit apparaître dans au moins une colonne cherchable.
  const filtered = useMemo(() => {
    const terms = normalize(q).split(/\s+/).filter(Boolean)
    if (!terms.length) return rows
    const cols = columns.filter((c) => c.searchable !== false)
    return rows.filter((r) => {
      const hay = normalize(cols.map((c) => String(c.accessor(r) ?? '')).join(' '))
      return terms.every((t) => hay.includes(t))
    })
  }, [rows, columns, q])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const col = columns.find((c) => c.id === sort.id)
    if (!col) return filtered
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const va = col.accessor(a)
      const vb = col.accessor(b)
      if ((va ?? '') === '') return 1
      if ((vb ?? '') === '') return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return (
        String(va).localeCompare(String(vb), 'fr', { sensitivity: 'base', numeric: true }) * dir
      )
    })
  }, [filtered, sort, columns])

  // La sélection ne garde que les lignes encore présentes.
  const rowIds = useMemo(() => new Set(rows.map(getRowId)), [rows, getRowId])
  const selectedRows = rows.filter((r) => selected.has(getRowId(r)))
  const [prevRowIds, setPrevRowIds] = useState(rowIds)
  if (rowIds !== prevRowIds) {
    setPrevRowIds(rowIds)
    setSelected((s) => {
      const next = new Set([...s].filter((id) => rowIds.has(id)))
      return next.size === s.size ? s : next
    })
  }

  useEffect(() => {
    onVisibleCountChange?.(sorted.length)
  }, [sorted.length, onVisibleCountChange])

  const maxFocusIdx = Math.max(0, sorted.length - 1)
  if (focusIdx > maxFocusIdx) setFocusIdx(maxFocusIdx)

  // « / » : aller à la recherche.
  useEffect(() => {
    if (!searchable || !searchHotkey) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !isTypingTarget(e.target)) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchable, searchHotkey])

  const visibleIds = sorted.map(getRowId)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someVisibleSelected = visibleIds.some((id) => selected.has(id))

  const toggle = (idx: number, range = false) => {
    const id = visibleIds[idx]
    if (id === undefined) return
    setSelected((s) => {
      const next = new Set(s)
      if (range && anchor.current !== null) {
        const [a, b] = [Math.min(anchor.current, idx), Math.max(anchor.current, idx)]
        const on = !s.has(id)
        for (let i = a; i <= b; i++) {
          if (on) next.add(visibleIds[i])
          else next.delete(visibleIds[i])
        }
      } else if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    anchor.current = idx
  }

  const toggleAll = () =>
    setSelected((s) => {
      const next = new Set(s)
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id))
      else visibleIds.forEach((id) => next.add(id))
      return next
    })

  const clearSelection = () => setSelected(new Set())

  const cycleSort = (id: string) =>
    setSort((s) =>
      !s || s.id !== id ? { id, dir: 'asc' } : s.dir === 'asc' ? { id, dir: 'desc' } : null
    )

  const focusRow = (i: number) => {
    const clamped = Math.max(0, Math.min(sorted.length - 1, i))
    setFocusIdx(clamped)
    rowRefs.current[clamped]?.focus()
  }

  const onRowKey = (e: ReactKeyboardEvent<HTMLTableRowElement>, idx: number, row: T) => {
    // Les contrôles dans une cellule (bouton, lien, champ) gardent leur comportement clavier.
    if (e.target !== e.currentTarget) return
    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        e.preventDefault()
        focusRow(idx + 1)
        break
      case 'ArrowUp':
      case 'k':
        e.preventDefault()
        focusRow(idx - 1)
        break
      case 'Home':
        e.preventDefault()
        focusRow(0)
        break
      case 'End':
        e.preventDefault()
        focusRow(sorted.length - 1)
        break
      case 'Enter':
        e.preventDefault()
        onRowClick?.(row)
        break
      case ' ':
      case 'x':
        if (!selectable) return
        e.preventDefault()
        toggle(idx, e.shiftKey)
        break
      case 'Escape':
        if (selected.size) {
          e.preventDefault()
          clearSelection()
        }
        break
      case 'a':
        if (selectable && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          toggleAll()
        }
        break
    }
  }

  const compact = density === 'compact'
  const cellY = compact ? 'py-1.5' : 'py-3'
  const alignCls = (a?: 'left' | 'right' | 'center') =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left'
  const colCount = columns.length + (selectable ? 1 : 0)
  const hideCls = (c: ProColumn<T>) =>
    c.hideOnTablet ? 'hidden lg:table-cell' : c.hideOnMobile ? 'hidden sm:table-cell' : undefined
  const showBar = selectable && selectedRows.length > 0

  return (
    <div
      className={cx('relative overflow-hidden rounded-lg border border-line bg-surface', className)}
    >
      {(searchable || toolbar || showDensityToggle) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-2.5 sm:p-3">
          {searchable && (
            <label className="relative flex min-w-0 flex-1 basis-56 items-center">
              <span className="sr-only">{labels.search}</span>
              <svg
                viewBox="0 0 16 16"
                className="pointer-events-none absolute left-3 size-4 text-ink-muted"
                aria-hidden
              >
                <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M10.5 10.5L14 14"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              <input
                ref={searchRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && q) {
                    e.preventDefault()
                    setQ('')
                  }
                  if (e.key === 'ArrowDown' && sorted.length) {
                    e.preventDefault()
                    focusRow(0)
                  }
                }}
                placeholder={labels.search}
                className="h-9 w-full rounded-md border border-line bg-canvas/60 pr-10 pl-9 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:bg-surface focus:outline-none [&::-webkit-search-cancel-button]:hidden"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => setQ('')}
                  aria-label={labels.clearSearch}
                  className={cx(
                    'absolute right-2 rounded-sm p-1 text-ink-muted hover:text-ink',
                    focusRing
                  )}
                >
                  <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                    <path
                      d="M2 2l8 8M10 2l-8 8"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              ) : (
                searchHotkey && (
                  <KeyboardHint
                    keys="/"
                    size="xs"
                    className="pointer-events-none absolute right-2.5 hidden sm:inline-flex"
                  />
                )
              )}
            </label>
          )}
          {toolbar}
          {showDensityToggle && (
            <div
              role="radiogroup"
              aria-label="Densité"
              className="ml-auto flex shrink-0 rounded-full bg-surface-2 p-0.5"
            >
              {(['comfortable', 'compact'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={density === d}
                  title={d === 'comfortable' ? labels.comfortable : labels.compact}
                  onClick={() => setDensity(d)}
                  className={cx(
                    'relative grid h-7 w-8 place-items-center rounded-full text-ink-muted',
                    density === d && 'text-ink',
                    focusRing
                  )}
                >
                  {density === d && (
                    <motion.span
                      layoutId="pdt-density"
                      className="absolute inset-0 rounded-full bg-surface shadow-card"
                      transition={spring}
                    />
                  )}
                  <svg viewBox="0 0 16 16" className="relative size-4" aria-hidden>
                    {(d === 'comfortable' ? [4, 8, 12] : [3, 6, 9, 12]).map((y) => (
                      <path
                        key={y}
                        d={`M3 ${y}h10`}
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    ))}
                  </svg>
                  <span className="sr-only">
                    {d === 'comfortable' ? labels.comfortable : labels.compact}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        className={cx('overflow-auto overscroll-contain transition-[padding]', showBar && 'pb-16')}
        style={{ maxHeight }}
      >
        <table
          role="grid"
          aria-busy={loading}
          aria-rowcount={sorted.length + 1}
          aria-multiselectable={selectable || undefined}
          className={cx(
            'w-full border-separate border-spacing-0 text-ink',
            compact ? 'text-[13px]' : 'text-sm'
          )}
        >
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {selectable && (
                <th
                  scope="col"
                  className="sticky top-0 z-10 w-10 border-b border-line bg-surface px-3 text-left"
                >
                  <Checkbox
                    checked={allVisibleSelected}
                    indeterminate={!allVisibleSelected && someVisibleSelected}
                    onChange={toggleAll}
                    label={labels.selectAll}
                    disabled={loading || !sorted.length}
                    tabIndex={0}
                    hitArea
                  />
                </th>
              )}
              {columns.map((c) => {
                const active = sort?.id === c.id
                const sortable = c.sortable !== false
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={
                      active
                        ? sort!.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : sortable
                          ? 'none'
                          : undefined
                    }
                    className={cx(
                      'sticky top-0 z-10 border-b border-line bg-surface px-3 py-2 text-xs font-medium whitespace-nowrap text-ink-muted',
                      alignCls(c.align),
                      c.width,
                      hideCls(c)
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => cycleSort(c.id)}
                        className={cx(
                          'group inline-flex items-center gap-1 rounded-sm hover:text-ink',
                          active && 'text-ink',
                          c.align === 'right' && 'flex-row-reverse',
                          focusRing
                        )}
                      >
                        {c.header}
                        <SortIcon dir={active ? sort!.dir : null} />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={`sk-${i}`} aria-hidden>
                  {selectable && (
                    <td className={cx('border-b border-line px-3', cellY)}>
                      <Skeleton className="size-4 rounded-[4px]" />
                    </td>
                  )}
                  {columns.map((c, k) => (
                    <td key={c.id} className={cx('border-b border-line px-3', cellY, hideCls(c))}>
                      <Skeleton
                        className={cx(
                          'h-3.5',
                          k === 0
                            ? 'w-36'
                            : c.align === 'right'
                              ? 'ml-auto w-10'
                              : ['w-24', 'w-16', 'w-28', 'w-20'][(i + k) % 4]
                        )}
                      />
                      {k === 0 && !compact && <Skeleton className="mt-1.5 h-2.5 w-20" />}
                    </td>
                  ))}
                </tr>
              ))}

            {!loading &&
              sorted.map((row, idx) => {
                const id = getRowId(row)
                const isSel = selected.has(id)
                const tone = rowTone?.(row)
                const isActive = activeRowId === id
                return (
                  <tr
                    key={id}
                    ref={(el) => {
                      rowRefs.current[idx] = el
                    }}
                    tabIndex={idx === focusIdx ? 0 : -1}
                    aria-selected={selectable ? isSel : undefined}
                    aria-label={getRowLabel?.(row)}
                    onFocus={() => setFocusIdx(idx)}
                    onKeyDown={(e) => onRowKey(e, idx, row)}
                    onClick={() => onRowClick?.(row)}
                    className={cx(
                      'group/row transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                      onRowClick && 'cursor-pointer',
                      isSel
                        ? 'bg-primary/[0.06]'
                        : isActive
                          ? 'bg-surface-2/70'
                          : 'hover:bg-surface-2/50',
                      'focus-visible:bg-surface-2/70'
                    )}
                  >
                    {selectable && (
                      <td
                        className={cx(
                          'relative cursor-pointer border-b border-line px-3 select-none',
                          cellY
                        )}
                        onClick={(e: ReactMouseEvent) => {
                          e.stopPropagation()
                          toggle(idx, e.shiftKey)
                        }}
                      >
                        <RowMarker tone={tone} active={isActive} />
                        <Checkbox
                          checked={isSel}
                          onChange={() => undefined}
                          label={`${labels.selectRow} ${getRowLabel?.(row) ?? ''}`.trim()}
                          tabIndex={-1}
                        />
                      </td>
                    )}
                    {columns.map((c, k) => (
                      <td
                        key={c.id}
                        className={cx(
                          'relative border-b border-line px-3 align-middle',
                          cellY,
                          alignCls(c.align),
                          c.align === 'right' && 'tabular-nums',
                          hideCls(c),
                          k === 0 &&
                            'group-focus-visible/row:shadow-[inset_2px_0_0_var(--color-primary)]'
                        )}
                      >
                        {!selectable && k === 0 && <RowMarker tone={tone} active={isActive} />}
                        {c.cell ? c.cell(row) : (c.accessor(row) ?? '—')}
                      </td>
                    ))}
                  </tr>
                )
              })}

            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center">
                  {q ? (
                    <div className="mx-auto max-w-sm">
                      <p className="text-sm font-medium text-ink">{labels.noResults(q)}</p>
                      <p className="mt-1 text-sm text-ink-muted">
                        Essayez un nom, une commune ou une référence de dossier.
                      </p>
                      <button
                        type="button"
                        onClick={() => setQ('')}
                        className={cx(
                          'mt-3 rounded-full border border-line px-3 py-1.5 text-sm font-medium text-primary hover:border-primary/40',
                          focusRing
                        )}
                      >
                        {labels.clearSearch}
                      </button>
                    </div>
                  ) : (
                    (empty ?? <p className="text-sm text-ink-muted">Aucune donnée.</p>)
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {loading && (
          <span className="sr-only" role="status">
            {labels.loading}
          </span>
        )}
      </div>

      <AnimatePresence>
        {showBar && (
          <motion.div
            role="toolbar"
            aria-label={labels.bulkBar}
            initial={{ y: 72, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 72, opacity: 0, transition: { duration: duration.fast, ease: ease.inOut } }}
            transition={spring}
            className="absolute inset-x-2 bottom-2 z-20 flex items-center gap-1 overflow-x-auto rounded-md bg-ink py-1.5 pr-1.5 pl-3 text-sm text-canvas shadow-card sm:inset-x-auto sm:left-1/2 sm:max-w-[calc(100%-1rem)] sm:-translate-x-1/2"
          >
            <span className="shrink-0 pr-2 font-semibold tabular-nums" aria-live="polite">
              {labels.selected(selectedRows.length)}
            </span>
            <span className="mx-1 h-5 w-px shrink-0 bg-canvas/20" aria-hidden />
            {bulkActions.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  a.onRun(selectedRows)
                  clearSelection()
                }}
                className={cx(
                  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm px-2.5 font-medium whitespace-nowrap hover:bg-canvas/10 focus-visible:outline-2 focus-visible:outline-accent',
                  a.tone === 'danger'
                    ? 'text-[color-mix(in_oklab,var(--color-danger)_45%,var(--color-canvas))]'
                    : 'text-canvas'
                )}
              >
                {a.icon}
                {a.label}
              </button>
            ))}
            <button
              type="button"
              onClick={clearSelection}
              aria-label={labels.clearSelection}
              title={labels.clearSelection}
              className="ml-1 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm px-2 text-canvas/70 hover:bg-canvas/10 hover:text-canvas focus-visible:outline-2 focus-visible:outline-accent"
            >
              <KeyboardHint keys="esc" tone="inverse" size="xs" className="hidden sm:inline-flex" />
              <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                <path
                  d="M2 2l8 8M10 2l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function RowMarker({ tone, active }: { tone?: 'danger' | 'warning'; active: boolean }) {
  if (!tone && !active) return null
  return (
    <span
      aria-hidden
      className={cx(
        'absolute inset-y-1 left-0 w-[3px] rounded-r-full',
        tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : 'bg-primary'
      )}
    />
  )
}

function SortIcon({ dir }: { dir: 'asc' | 'desc' | null }) {
  return (
    <svg
      viewBox="0 0 10 12"
      className={cx(
        'size-2.5 shrink-0 transition-opacity',
        dir ? 'opacity-100' : 'opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60'
      )}
      aria-hidden
    >
      <motion.path
        d="M2 4.5L5 1.5L8 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={{ opacity: dir === 'desc' ? 0.25 : 1 }}
      />
      <motion.path
        d="M2 7.5L5 10.5L8 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={{ opacity: dir === 'asc' ? 0.25 : 1 }}
      />
    </svg>
  )
}

function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  disabled,
  tabIndex,
  hitArea = false,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: () => void
  label: string
  disabled?: boolean
  tabIndex?: number
  /** Zone cliquable de 28 px autour de la case (WCAG 2.5.8). Pas dans une cellule déjà cliquable. */
  hitArea?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  const input = (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      disabled={disabled}
      tabIndex={tabIndex}
      className={cx(
        'block size-4 cursor-pointer rounded-[4px] accent-primary disabled:cursor-default',
        focusRing
      )}
    />
  )
  return hitArea ? (
    <label className="-m-1.5 grid size-7 cursor-pointer place-items-center">{input}</label>
  ) : (
    input
  )
}
