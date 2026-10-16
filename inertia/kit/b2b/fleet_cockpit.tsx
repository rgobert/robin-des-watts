import { motion } from 'motion/react'
import { useMemo, useState, type ReactNode } from 'react'
import { AnimatedNumber } from '../components/animated_number'
import { useToast } from '../components/toast'
import { duration, fadeUp, spring, stagger } from '../motion'
import { cx, formatEuro } from '../utils'
import { ProDataTable, type ProColumn } from './pro_data_table'
import { focusRing, formatRelativeFr } from './shared'

export type FleetIssue = 'robin_offline' | 'smart_off' | 'reward_zero' | 'activation_late' | 'ok'

export type FleetClient = {
  id: string
  name: string
  commune: string
  issue: FleetIssue
  /** Début du problème (ISO). */
  since: string
  /** Contexte court : « Dernier signal : box internet changée ? ». */
  detail?: string
  /** Cagnotte gagnée cette année (€). */
  rewardYear: number
  /** Valeur perdue estimée tant que le problème dure (€ par mois). */
  lossPerMonth: number
}

export type FleetIssueConfig = {
  label: string
  tone: 'danger' | 'warning' | 'success'
  /** Plus petit = plus urgent dans la file. */
  priority: number
  fix?: { label: string; pending: string; done: string; toast: (c: FleetClient) => string }
}

export const DEFAULT_FLEET_ISSUES: Record<FleetIssue, FleetIssueConfig> = {
  robin_offline: {
    label: 'Robin hors ligne',
    tone: 'danger',
    priority: 0,
    fix: {
      label: 'Relancer Robin à distance',
      pending: 'Relance…',
      done: 'Robin en ligne',
      toast: (c) => `Robin de ${c.name} relancé, de nouveau en ligne`,
    },
  },
  activation_late: {
    label: 'Activation en retard',
    tone: 'danger',
    priority: 1,
    fix: {
      label: 'Relancer l’activation',
      pending: 'Relance…',
      done: 'Activation relancée',
      toast: (c) => `Activation relancée auprès de mylight150 pour ${c.name}`,
    },
  },
  smart_off: {
    label: 'Mode Smart désactivé',
    tone: 'warning',
    priority: 2,
    fix: {
      label: 'Envoyer le guide de réactivation',
      pending: 'Envoi…',
      done: 'Guide envoyé',
      toast: (c) => `Guide de réactivation envoyé à ${c.name}`,
    },
  },
  reward_zero: {
    label: 'Cagnotte à 0 depuis 30 j',
    tone: 'warning',
    priority: 3,
    fix: {
      label: 'Proposer un appel de contrôle',
      pending: 'Envoi…',
      done: 'Appel proposé',
      toast: (c) => `Créneaux d’appel proposés à ${c.name}`,
    },
  },
  ok: { label: 'Tout va bien', tone: 'success', priority: 9 },
}

type FixState = 'idle' | 'loading' | 'done'

/**
 * Cockpit « Mes clients mylight150 » : le parc installé trié par statut de VALEUR client (pas seulement matériel),
 * compteurs cliquables, file priorisée (urgence puis € perdus), action de correction par ligne avec états, toast d'annulation,
 * correction groupée, et une preuve sociale chiffrée réutilisable en vente.
 * Pattern : P19 (Enphase Installer Platform) + white space n°5, benchmark-concurrentiel_suivi-conso.md.
 * Friction traitée : l'installateur découvre qu'un client ne gagne plus rien quand celui-ci appelle pour se plaindre.
 */
export function FleetCockpit({
  clients: clientsProp,
  issues = DEFAULT_FLEET_ISSUES,
  onFix,
  onCopyProof,
  title = 'Mes clients mylight150',
  className,
}: {
  clients: FleetClient[]
  issues?: Record<FleetIssue, FleetIssueConfig>
  /** Appel réel de correction. Par défaut : simulé (1,2 s). Si la promesse échoue, la ligne revient. */
  onFix?: (client: FleetClient) => Promise<void>
  /** Copie de la preuve sociale (devis, site). Reçoit le texte. */
  onCopyProof?: (text: string) => void
  title?: string
  className?: string
}) {
  const toast = useToast()
  const [clients, setClients] = useState(clientsProp)
  const [filter, setFilter] = useState<FleetIssue | 'todo' | 'all'>('todo')
  const [fix, setFix] = useState<Record<string, FixState>>({})
  const [previous, setPrevious] = useState<Record<string, FleetIssue>>({})

  const counts = useMemo(() => {
    const c = Object.fromEntries(
      (Object.keys(issues) as FleetIssue[]).map((k) => [k, 0])
    ) as Record<FleetIssue, number>
    clients.forEach((x) => c[x.issue]++)
    return c
  }, [clients, issues])
  const todo = clients.filter((c) => c.issue !== 'ok')
  const loss = todo.reduce((s, c) => s + c.lossPerMonth, 0)
  const healthy = clients.filter((c) => c.issue === 'ok')
  const avgReward = healthy.length
    ? Math.round(healthy.reduce((s, c) => s + c.rewardYear, 0) / healthy.length)
    : 0

  const rows = useMemo(() => {
    const list =
      filter === 'all'
        ? clients
        : filter === 'todo'
          ? clients.filter((c) => c.issue !== 'ok' || fix[c.id] === 'done')
          : clients.filter(
              (c) => c.issue === filter || (fix[c.id] === 'done' && previous[c.id] === filter)
            )
    const prio = (c: FleetClient) =>
      issues[fix[c.id] === 'done' ? (previous[c.id] ?? c.issue) : c.issue].priority
    return [...list].sort((a, b) => prio(a) - prio(b) || b.lossPerMonth - a.lossPerMonth)
  }, [clients, filter, fix, previous, issues])

  const runFix = async (c: FleetClient) => {
    const conf = issues[c.issue]
    if (!conf.fix || fix[c.id] === 'loading') return
    const prevIssue = c.issue
    setFix((f) => ({ ...f, [c.id]: 'loading' }))
    try {
      await (onFix ? onFix(c) : new Promise((r) => setTimeout(r, 1200)))
    } catch {
      setFix((f) => ({ ...f, [c.id]: 'idle' }))
      toast({ message: `Échec pour ${c.name}, réessayez dans un instant` })
      return
    }
    setPrevious((p) => ({ ...p, [c.id]: prevIssue }))
    setFix((f) => ({ ...f, [c.id]: 'done' }))
    setClients((cs) => cs.map((x) => (x.id === c.id ? { ...x, issue: 'ok' } : x)))
    toast({
      message: conf.fix.toast(c),
      tone: 'success',
      actionLabel: 'Annuler',
      onAction: () => {
        setClients((cs) => cs.map((x) => (x.id === c.id ? { ...x, issue: prevIssue } : x)))
        setFix((f) => ({ ...f, [c.id]: 'idle' }))
      },
    })
  }

  const tiles: {
    id: FleetIssue | 'todo'
    label: string
    n: number
    tone?: FleetIssueConfig['tone']
  }[] = [
    { id: 'todo', label: 'À traiter', n: todo.length },
    ...(Object.keys(issues) as FleetIssue[])
      .filter((k) => k !== 'ok')
      .map((k) => ({ id: k, label: issues[k].label, n: counts[k], tone: issues[k].tone })),
    { id: 'ok', label: issues.ok.label, n: counts.ok, tone: 'success' as const },
  ]

  const columns: ProColumn<FleetClient>[] = [
    {
      id: 'name',
      header: 'Client',
      accessor: (c) => `${c.name} ${c.commune}`,
      cell: (c) => (
        <div className="min-w-32">
          <p className="font-medium text-ink">{c.name}</p>
          <p className="text-xs text-ink-muted">{c.commune}</p>
        </div>
      ),
    },
    {
      id: 'issue',
      header: 'Statut',
      accessor: (c) => `${issues[c.issue].priority} ${issues[c.issue].label}`,
      cell: (c) => {
        const conf = issues[c.issue]
        return (
          <div className="min-w-40">
            <IssueBadge conf={conf} />
            <p className="mt-0.5 text-xs text-ink-muted">
              {c.issue === 'ok'
                ? `Cagnotte ${formatEuro(c.rewardYear)} cette année`
                : `depuis ${formatRelativeFr(c.since).replace(/^il y a /, '')}${c.detail ? ` · ${c.detail}` : ''}`}
            </p>
          </div>
        )
      },
    },
    {
      id: 'loss',
      header: 'Valeur perdue',
      align: 'right',
      searchable: false,
      accessor: (c) => (c.issue === 'ok' ? 0 : c.lossPerMonth),
      cell: (c) =>
        c.issue === 'ok' ? (
          <span className="text-ink-muted">—</span>
        ) : (
          <span className="font-medium whitespace-nowrap text-ink">
            {formatEuro(c.lossPerMonth)}/mois
          </span>
        ),
    },
    {
      id: 'action',
      header: 'Correction',
      sortable: false,
      searchable: false,
      align: 'right',
      accessor: () => '',
      cell: (c) => {
        const st = fix[c.id] ?? 'idle'
        const conf = issues[st === 'done' ? (previous[c.id] ?? c.issue) : c.issue]
        if (!conf.fix) return <span className="text-xs text-ink-muted">Rien à faire</span>
        return (
          <motion.button
            type="button"
            whileTap={st === 'idle' ? { scale: 0.97 } : undefined}
            transition={spring}
            disabled={st !== 'idle'}
            aria-busy={st === 'loading'}
            onClick={(e) => {
              e.stopPropagation()
              runFix(c)
            }}
            className={cx(
              'inline-flex min-h-8 max-w-48 items-center gap-1.5 rounded-full px-3 py-1 text-left text-xs leading-tight font-semibold transition-colors',
              st === 'idle' &&
                'border border-line bg-surface text-ink hover:border-primary/50 hover:text-primary',
              st === 'loading' && 'border border-line bg-surface-2 text-ink-muted',
              st === 'done' && 'bg-success/[0.08] text-success',
              focusRing
            )}
          >
            {st === 'loading' && (
              <span
                className="kit-spin block size-3 rounded-full border-[1.5px] border-current/30 border-t-current"
                aria-hidden
              />
            )}
            {st === 'done' && (
              <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
                <motion.path
                  d="M3.5 8.5l3 3 6-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: duration.base }}
                />
              </svg>
            )}
            {st === 'loading' ? conf.fix.pending : st === 'done' ? conf.fix.done : conf.fix.label}
          </motion.button>
        )
      },
    },
  ]

  const proof = `Mes ${healthy.length} clients mylight150 suivis ont gagné en moyenne ${formatEuro(avgReward)} de cagnotte cette année.`

  return (
    <div className={cx('space-y-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-xl text-ink">{title}</p>
          <p className="text-sm text-ink-muted">
            {clients.length} foyers équipés de Robin ·{' '}
            {loss > 0 ? (
              <>
                <span className="font-semibold text-danger">
                  <AnimatedNumber value={loss} suffix=" €" />
                </span>{' '}
                par mois de gains perdus chez vos clients
              </>
            ) : (
              <span className="font-semibold text-success">tous vos clients gagnent</span>
            )}
          </p>
        </div>
      </div>

      <motion.div
        role="group"
        aria-label="Filtrer par statut"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
        variants={stagger(0.04)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
      >
        {tiles.map((t) => {
          const on = filter === t.id
          return (
            <motion.button
              key={t.id}
              variants={fadeUp}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(on && t.id !== 'todo' ? 'todo' : t.id)}
              className={cx(
                'relative rounded-md border bg-surface p-3 text-left transition-colors',
                on ? 'border-transparent' : 'border-line hover:border-ink/25',
                focusRing
              )}
            >
              {on && (
                <motion.span
                  layoutId="fleet-tile"
                  className="absolute inset-0 rounded-md border-2 border-primary"
                  transition={spring}
                />
              )}
              <span className="relative flex items-center gap-1.5 text-xs text-ink-muted">
                {t.tone && (
                  <span
                    className={cx(
                      'size-1.5 shrink-0 rounded-full',
                      t.tone === 'danger'
                        ? 'bg-danger'
                        : t.tone === 'warning'
                          ? 'bg-warning'
                          : 'bg-success'
                    )}
                  />
                )}
                <span className="truncate">{t.label}</span>
              </span>
              <span
                className={cx(
                  'relative mt-1 block font-display text-2xl font-semibold',
                  t.n === 0 ? 'text-ink-muted' : 'text-ink'
                )}
              >
                <AnimatedNumber value={t.n} duration={0.5} />
              </span>
            </motion.button>
          )
        })}
      </motion.div>

      <ProDataTable
        rows={rows}
        columns={columns}
        getRowId={(c) => c.id}
        getRowLabel={(c) => `${c.name}, ${issues[c.issue].label}`}
        rowTone={(c) =>
          c.issue === 'ok' ? undefined : issues[c.issue].tone === 'danger' ? 'danger' : 'warning'
        }
        selectable
        bulkActions={[
          {
            id: 'fix',
            label: 'Corriger la sélection',
            onRun: (sel) =>
              sel
                .filter((c) => issues[c.issue].fix && (fix[c.id] ?? 'idle') === 'idle')
                .forEach((c) => runFix(c)),
          },
        ]}
        showDensityToggle={false}
        labels={{ search: 'Rechercher un client…' }}
        maxHeight="26rem"
        caption={title}
        empty={
          <div>
            <p className="text-sm font-medium text-ink">Rien à traiter dans ce statut</p>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={cx(
                'mt-2 rounded-sm text-sm font-medium text-primary hover:underline',
                focusRing
              )}
            >
              Voir tout le parc
            </button>
          </div>
        }
      />

      {healthy.length > 0 && (
        <ProofCard text={proof} onCopy={() => onCopyProof?.(proof)}>
          <span className="font-display text-2xl font-semibold text-reward">
            <AnimatedNumber value={avgReward} suffix=" €" />
          </span>{' '}
          <span className="text-sm text-ink">
            de cagnotte moyenne pour vos {healthy.length} clients actifs
          </span>
        </ProofCard>
      )}
    </div>
  )
}

function IssueBadge({ conf }: { conf: FleetIssueConfig }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        conf.tone === 'danger' && 'bg-danger/10 text-danger',
        conf.tone === 'warning' &&
          'bg-warning/12 text-[color-mix(in_oklab,var(--color-warning)_65%,var(--color-ink))]',
        conf.tone === 'success' && 'bg-success/10 text-success'
      )}
    >
      <span
        className={cx(
          'size-1.5 rounded-full',
          conf.tone === 'danger'
            ? 'bg-danger'
            : conf.tone === 'warning'
              ? 'bg-warning'
              : 'bg-success'
        )}
      />
      {conf.label}
    </span>
  )
}

function ProofCard({
  children,
  text,
  onCopy,
}: {
  children: ReactNode
  text: string
  onCopy: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-reward/30 bg-reward/[0.06] p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
          Preuve à réutiliser en rendez-vous
        </p>
        <p className="mt-1">{children}</p>
        <p className="mt-1 text-xs text-ink-muted">« {text} »</p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className={cx(
          'h-10 shrink-0 rounded-full border border-reward/40 bg-surface px-4 text-sm font-semibold text-reward hover:bg-reward/10',
          focusRing
        )}
      >
        Copier pour un devis
      </button>
    </div>
  )
}
