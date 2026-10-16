import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Skeleton } from '../components/skeleton'
import { useToast } from '../components/toast'
import { duration, ease } from '../motion'
import { cx, formatEuro } from '../utils'
import { WARNING_TEXT, fmtDateShort } from './chart_utils'
import { AccountDrawer, AccountStatusBadge, RefundForm, SuspendConfirm } from './account_drawer'
import { MOCK_TODAY, OFFERS, type AccountStatus, type CustomerAccount, type OfferId } from './mocks'

type StatusFilter = 'tous' | AccountStatus
const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'tous', label: 'Tous' },
  { key: 'actif', label: 'Actifs' },
  { key: 'activation', label: 'En activation' },
  { key: 'impaye', label: 'Impayés' },
  { key: 'resilie', label: 'Résiliés' },
  { key: 'suspendu', label: 'Suspendus' },
]
const ROBIN_DOT: Record<CustomerAccount['robin'], string> = {
  'en ligne': 'bg-success',
  'hors ligne': 'bg-danger',
  'non installé': 'bg-grid',
}

/* ---------- menu d'actions par ligne (clavier : flèches, Échap) ---------- */
type RowAction = 'view' | 'impersonate' | 'suspend' | 'reactivate' | 'refund'

function RowMenu({
  account,
  onAction,
  buttonRef,
}: {
  account: CustomerAccount
  onAction: (a: RowAction) => void
  /** Expose le bouton « … » pour y rendre le focus après une confirmation inline. */
  buttonRef?: (el: HTMLButtonElement | null) => void
}) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement | null>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])
  const wrap = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 })
  const entries: { key: RowAction; label: string; tone?: string }[] = [
    { key: 'view', label: 'Voir le compte' },
    { key: 'impersonate', label: 'Se connecter en tant que' },
    { key: 'refund', label: 'Rembourser' },
    account.status === 'suspendu'
      ? { key: 'reactivate', label: 'Réactiver', tone: 'text-success' }
      : { key: 'suspend', label: 'Suspendre…', tone: WARNING_TEXT },
  ]
  const list = account.status === 'resilie' ? entries.filter((e) => e.key !== 'suspend') : entries

  const toggle = () => {
    const r = btn.current?.getBoundingClientRect()
    if (r) {
      const right = Math.max(8, window.innerWidth - r.right)
      setPos(
        r.bottom + 200 > window.innerHeight
          ? { bottom: window.innerHeight - r.top + 4, right }
          : { top: r.bottom + 4, right }
      )
    }
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    items.current[0]?.focus({ preventScroll: true })
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      btn.current?.focus()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const n = (i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length
      items.current[n]?.focus({ preventScroll: true })
    } else if (e.key === 'Tab') setOpen(false)
  }

  return (
    <div ref={wrap}>
      <button
        ref={(el) => {
          btn.current = el
          buttonRef?.(el)
        }}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions pour ${account.name}`}
        onClick={(e) => {
          e.stopPropagation()
          toggle()
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            toggle()
          }
        }}
        className="rounded-full p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
      >
        <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
          <circle cx="3.5" cy="8" r="1.3" />
          <circle cx="8" cy="8" r="1.3" />
          <circle cx="12.5" cy="8" r="1.3" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label={`Actions pour ${account.name}`}
            initial={{ opacity: 0, y: reduce ? 0 : -4, scale: reduce ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: duration.instant } }}
            transition={{ duration: duration.fast, ease: ease.out }}
            style={pos}
            className="fixed z-30 w-56 origin-top-right rounded-md border border-line bg-surface p-1 shadow-card"
          >
            {list.map((it, i) => (
              <button
                key={it.key}
                ref={(n) => {
                  items.current[i] = n
                }}
                role="menuitem"
                type="button"
                onKeyDown={(e) => onKey(e, i)}
                onClick={(e) => {
                  e.stopPropagation()
                  // le focus revient sur « … » avant l'action : le panneau ou la confirmation inline le rendra ici
                  btn.current?.focus({ preventScroll: true })
                  setOpen(false)
                  onAction(it.key)
                }}
                className={cx(
                  'block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-surface-2 focus:bg-surface-2 focus:outline-none',
                  it.tone ?? 'text-ink'
                )}
              >
                {it.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Administration des comptes clients : recherche, filtres de statut avec compteurs, tri par MRR,
 * menu d'actions par ligne (voir, se connecter en tant que, suspendre avec confirmation inline, rembourser),
 * panneau latéral de détail.
 * Friction traitée : le support jongle entre outils pour une action simple ; ici on trouve, on comprend et on agit au même endroit,
 * avec confirmation sur place pour l'irréversible et annulation par toast pour le reste.
 */
export function AccountsTable({
  accounts,
  offerFilter = null,
  onOfferFilterChange,
  pageSize = 8,
  searchPlaceholder = 'Rechercher un nom, un e-mail, un n° de compte, une ville…',
  offerLabels = Object.fromEntries(Object.entries(OFFERS).map(([k, v]) => [k, v.label])) as Record<
    OfferId,
    string
  >,
  loading = false,
  className,
}: {
  accounts: CustomerAccount[]
  /** Filtre d'offre piloté de l'extérieur (ex. depuis un insight « Voir les comptes »). */
  offerFilter?: OfferId | null
  onOfferFilterChange?: (o: OfferId | null) => void
  pageSize?: number
  searchPlaceholder?: string
  offerLabels?: Record<OfferId, string>
  /** Chargement : 8 lignes de skeleton à la place des données (aria-busy sur le tableau). */
  loading?: boolean
  className?: string
}) {
  const toast = useToast()
  const reduce = useReducedMotion()
  const [rows, setRows] = useState(accounts)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('tous')
  const [localOffer, setLocalOffer] = useState<OfferId | null>(offerFilter)
  const [sortDesc, setSortDesc] = useState<boolean | null>(null)
  const [limit, setLimit] = useState(pageSize)
  const [inline, setInline] = useState<{ id: string; kind: 'suspend' | 'refund' } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  // Boutons « … » par ligne : le focus y revient après « Confirmer la suspension » / « Annuler ».
  const menuBtns = useRef<Record<string, HTMLButtonElement | null>>({})
  const closeInline = (id: string) => {
    setInline(null)
    requestAnimationFrame(() => {
      const b = menuBtns.current[id]
      if (b?.isConnected) b.focus({ preventScroll: true })
    })
  }

  // Le filtre d'offre suit la prop ; tout changement de filtre repart de la première page.
  const [prevOfferFilter, setPrevOfferFilter] = useState(offerFilter)
  if (offerFilter !== prevOfferFilter) {
    setPrevOfferFilter(offerFilter)
    setLocalOffer(offerFilter)
  }
  const filterKey = JSON.stringify([query, status, localOffer, pageSize])
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setLimit(pageSize)
  }

  const offer = localOffer
  const setOffer = (o: OfferId | null) => {
    setLocalOffer(o)
    onOfferFilterChange?.(o)
  }

  const matchesQuery = (a: CustomerAccount) => {
    const q = query.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (!q) return true
    return [a.name, a.email, a.id, a.city].some((f) =>
      f.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)
    )
  }
  const base = rows.filter((a) => matchesQuery(a) && (!offer || a.offer === offer))
  const counts = useMemo(() => {
    const c: Record<string, number> = { tous: base.length }
    for (const a of base) c[a.status] = (c[a.status] ?? 0) + 1
    return c
  }, [base])
  let filtered = status === 'tous' ? base : base.filter((a) => a.status === status)
  if (sortDesc !== null)
    filtered = [...filtered].sort((a, b) => (sortDesc ? b.mrr - a.mrr : a.mrr - b.mrr))
  const visible = filtered.slice(0, limit)
  const mrrTotal = filtered.reduce((s, a) => s + a.mrr, 0)
  const opened = rows.find((r) => r.id === openId) ?? null

  const update = (id: string, patch: (a: CustomerAccount) => CustomerAccount) =>
    setRows((rs) => rs.map((r) => (r.id === id ? patch(r) : r)))
  const addEvent = (
    a: CustomerAccount,
    label: string,
    tone?: 'neutral' | 'success' | 'warning' | 'danger'
  ) => ({
    ...a,
    timeline: [{ date: MOCK_TODAY, label, tone }, ...a.timeline],
  })

  const impersonate = (a: CustomerAccount) => {
    update(a.id, (r) => addEvent(r, 'Connexion support « en tant que » (lecture seule)'))
    toast({
      message: `Vous voyez l'espace de ${a.name} en lecture seule. Session tracée.`,
      actionLabel: 'Quitter',
      onAction: () => toast({ message: 'Session support terminée.', duration: 2500 }),
    })
  }
  const suspend = (a: CustomerAccount) => {
    const prev = a
    update(a.id, (r) =>
      addEvent(
        { ...r, status: 'suspendu', smart: false },
        'Compte suspendu par le support',
        'warning'
      )
    )
    closeInline(a.id)
    toast({
      message: `Compte de ${a.name} suspendu.`,
      actionLabel: 'Annuler',
      onAction: () => update(a.id, () => prev),
    })
  }
  const reactivate = (a: CustomerAccount) => {
    const prev = a
    update(a.id, (r) => addEvent({ ...r, status: 'actif' }, 'Compte réactivé', 'success'))
    toast({
      message: `Compte de ${a.name} réactivé.`,
      tone: 'success',
      actionLabel: 'Annuler',
      onAction: () => update(a.id, () => prev),
    })
  }
  const refund = (a: CustomerAccount, amount: number, reason: string) => {
    const prev = a
    update(a.id, (r) =>
      addEvent(r, `Remboursement de ${formatEuro(amount, 2)} (${reason.toLowerCase()})`, 'success')
    )
    closeInline(a.id)
    toast({
      message: `Remboursement de ${formatEuro(amount, 2)} programmé pour ${a.name}.`,
      tone: 'success',
      actionLabel: 'Annuler',
      onAction: () => update(a.id, () => prev),
    })
  }

  const onAction = (a: CustomerAccount, kind: RowAction) => {
    if (kind === 'view') setOpenId(a.id)
    else if (kind === 'impersonate') impersonate(a)
    else if (kind === 'reactivate') reactivate(a)
    else setInline({ id: a.id, kind })
  }

  const reset = () => {
    setQuery('')
    setStatus('tous')
    setOffer(null)
  }

  return (
    <div className={cx('min-w-0', className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Rechercher un compte</span>
          <svg
            viewBox="0 0 16 16"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
            aria-hidden
          >
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M10.5 10.5 14 14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-full border border-line bg-surface py-2 pr-3 pl-9 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          Offre
          <select
            value={offer ?? ''}
            onChange={(e) => setOffer((e.target.value || null) as OfferId | null)}
            className="rounded-full border border-line bg-surface px-3 py-2 text-sm text-ink"
          >
            <option value="">Toutes</option>
            {(Object.keys(offerLabels) as OfferId[]).map((o) => (
              <option key={o} value={o}>
                {offerLabels[o]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className="mt-3 flex gap-1.5 overflow-x-auto pb-1"
        role="group"
        aria-label="Filtrer par statut"
      >
        {FILTERS.filter((f) => f.key !== 'suspendu' || counts.suspendu).map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={status === f.key}
            onClick={() => setStatus(f.key)}
            className={cx(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary',
              status === f.key
                ? 'border-primary bg-primary text-primary-contrast'
                : 'border-line bg-surface text-ink-muted hover:text-ink'
            )}
          >
            {f.label}
            <span
              className={cx(
                'text-xs tabular-nums',
                status === f.key ? 'opacity-80' : 'text-ink-muted'
              )}
            >
              {counts[f.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {offer && (
        <p className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
          Filtre actif :
          <button
            type="button"
            onClick={() => setOffer(null)}
            className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 font-medium text-ink hover:bg-line"
          >
            Offre {offerLabels[offer]}
            <span aria-hidden>×</span>
            <span className="sr-only">(retirer)</span>
          </button>
        </p>
      )}

      <div className="mt-3 overflow-x-auto rounded-md border border-line bg-surface">
        <table className="w-full text-left text-sm" aria-busy={loading || undefined}>
          <thead className="border-b border-line bg-surface-2/40 text-xs text-ink-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Client
              </th>
              <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">
                Offre
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Statut
              </th>
              <th scope="col" className="hidden px-3 py-2 font-medium lg:table-cell">
                Robin
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-right font-medium"
                aria-sort={sortDesc === null ? 'none' : sortDesc ? 'descending' : 'ascending'}
              >
                <button
                  type="button"
                  onClick={() => setSortDesc((s) => (s === null ? true : s ? false : null))}
                  className="inline-flex items-center gap-1 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
                >
                  MRR
                  <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
                    <path
                      d="M2 4l3-3 3 3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      opacity={sortDesc === false ? 1 : 0.35}
                    />
                    <path
                      d="M2 6l3 3 3-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      opacity={sortDesc === true ? 1 : 0.35}
                    />
                  </svg>
                </button>
              </th>
              <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell">
                Depuis
              </th>
              <th scope="col" className="w-10 px-2 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} />)}
            {!loading &&
              visible.map((a) => (
                <Fragment key={a.id}>
                  <motion.tr
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: duration.fast }}
                    className={cx(
                      'border-b border-line last:border-0 hover:bg-surface-2/40',
                      openId === a.id && 'bg-surface-2/60'
                    )}
                  >
                    <td className="max-w-0 px-3 py-2.5 sm:max-w-none">
                      <button
                        type="button"
                        onClick={() => setOpenId(a.id)}
                        className="block max-w-full text-left focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <span className="block truncate font-medium text-ink hover:underline">
                          {a.name}
                        </span>
                        <span className="block truncate text-xs text-ink-muted tabular-nums">
                          {a.id} · {a.city}
                        </span>
                      </button>
                    </td>
                    <td className="hidden px-3 py-2.5 whitespace-nowrap text-ink md:table-cell">
                      {offerLabels[a.offer]}
                    </td>
                    <td className="px-3 py-2.5">
                      <AccountStatusBadge status={a.status} />
                    </td>
                    <td className="hidden px-3 py-2.5 whitespace-nowrap text-ink-muted lg:table-cell">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={cx('size-1.5 rounded-full', ROBIN_DOT[a.robin])}
                          aria-hidden
                        />
                        {a.robin}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap text-ink tabular-nums">
                      {a.mrr ? formatEuro(a.mrr, 2) : '–'}
                    </td>
                    <td className="hidden px-3 py-2.5 whitespace-nowrap text-ink-muted tabular-nums sm:table-cell">
                      {fmtDateShort(a.since)}
                    </td>
                    <td className="px-2 py-2.5">
                      <RowMenu
                        account={a}
                        onAction={(k) => onAction(a, k)}
                        buttonRef={(el) => {
                          menuBtns.current[a.id] = el
                        }}
                      />
                    </td>
                  </motion.tr>
                  {inline?.id === a.id && (
                    <tr className="border-b border-line bg-surface">
                      <td colSpan={7} className="px-3 py-2">
                        {inline.kind === 'suspend' ? (
                          <SuspendConfirm
                            name={a.name}
                            onCancel={() => closeInline(a.id)}
                            onConfirm={() => suspend(a)}
                          />
                        ) : (
                          <RefundForm
                            defaultAmount={a.mrr}
                            onCancel={() => closeInline(a.id)}
                            onSubmit={(amt, reason) => refund(a, amt, reason)}
                          />
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
          </tbody>
        </table>
        {loading && (
          <span className="sr-only" role="status">
            Chargement des comptes…
          </span>
        )}
        {!loading && filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-sm">
            <p className="text-ink">Aucun compte ne correspond.</p>
            <button
              type="button"
              onClick={reset}
              className="mt-2 font-medium text-primary hover:underline"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
        <p className="tabular-nums" aria-live="polite">
          {loading
            ? 'Chargement des comptes…'
            : `${Math.min(limit, filtered.length)} sur ${filtered.length} comptes · MRR ${formatEuro(mrrTotal)}`}
        </p>
        {!loading && filtered.length > limit && (
          <button
            type="button"
            onClick={() => setLimit((l) => l + pageSize)}
            className="rounded-full border border-line bg-surface px-4 py-1.5 font-medium text-ink hover:border-ink-muted"
          >
            Afficher {Math.min(pageSize, filtered.length - limit)} de plus
          </button>
        )}
      </div>

      <AccountDrawer
        account={opened}
        onClose={() => setOpenId(null)}
        onImpersonate={impersonate}
        onSuspend={suspend}
        onReactivate={reactivate}
        onRefund={refund}
        offerLabels={offerLabels}
      />
    </div>
  )
}

/** Ligne en chargement : mêmes colonnes et mêmes points de rupture que les lignes réelles. */
function SkeletonRow() {
  return (
    <tr className="border-b border-line last:border-0" aria-hidden>
      <td className="px-3 py-2.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="mt-1.5 h-3 w-24" />
      </td>
      <td className="hidden px-3 py-2.5 md:table-cell">
        <Skeleton className="h-3.5 w-16" />
      </td>
      <td className="px-3 py-2.5">
        <Skeleton className="h-5 w-20 rounded-full" />
      </td>
      <td className="hidden px-3 py-2.5 lg:table-cell">
        <Skeleton className="h-3.5 w-16" />
      </td>
      <td className="px-3 py-2.5">
        <Skeleton className="ml-auto h-3.5 w-14" />
      </td>
      <td className="hidden px-3 py-2.5 sm:table-cell">
        <Skeleton className="h-3.5 w-16" />
      </td>
      <td className="px-2 py-2.5">
        <Skeleton className="size-7 rounded-full" />
      </td>
    </tr>
  )
}
