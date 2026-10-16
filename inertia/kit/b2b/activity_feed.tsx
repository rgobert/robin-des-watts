import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { duration, ease, spring } from '../motion'
import { cx } from '../utils'
import { focusRing, formatDayLabel, formatRelativeFr, initials, startOfDay } from './shared'

export type ActivityActorKind = 'installer' | 'mylight' | 'client' | 'system' | 'enedis'

export type ActivityEntry = {
  id: string
  /** Date ISO ou objet Date. */
  at: string | Date
  actor: { name: string; kind?: ActivityActorKind }
  /** Verbe + complément : « a signé le devis », « a posé le coffret Robin ». */
  action: ReactNode
  detail?: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}

const KIND_CLS: Record<ActivityActorKind, string> = {
  installer: 'bg-primary text-primary-contrast',
  mylight: 'bg-accent/25 text-primary',
  client: 'bg-solar/25 text-ink',
  system: 'bg-surface-2 text-ink-muted',
  enedis: 'bg-grid/25 text-ink',
}

/**
 * Fil d'activité d'un dossier : qui, quoi, quand (relatif, date exacte au survol), regroupé par jour, avec note rapide.
 * Le temps relatif se met à jour tout seul.
 * Friction traitée : « qui a relancé Enedis, et quand ? » ; l'historique éparpillé entre mails, SMS et tableur.
 */
export function ActivityFeed({
  items,
  maxInitial = 6,
  onAddNote,
  noteAuthor,
  labels,
  className,
}: {
  items: ActivityEntry[]
  maxInitial?: number
  /** Si fourni : champ « Ajouter une note » en tête du fil. */
  onAddNote?: (text: string) => void
  noteAuthor?: string
  labels?: Partial<{
    more: (n: number) => string
    less: string
    notePlaceholder: string
    noteSubmit: string
    empty: string
  }>
  className?: string
}) {
  const L = {
    more: (n: number) => `Voir ${n} activité${n > 1 ? 's' : ''} de plus`,
    less: 'Réduire',
    notePlaceholder: 'Ajouter une note au dossier…',
    noteSubmit: 'Ajouter',
    empty: 'Aucune activité pour l’instant.',
    ...labels,
  }
  const [now, setNow] = useState(() => new Date())
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')
  const inputId = useId()

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const sorted = useMemo(
    () => [...items].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [items]
  )
  const shown = expanded ? sorted : sorted.slice(0, maxInitial)
  const groups = useMemo(() => {
    const map = new Map<number, ActivityEntry[]>()
    for (const it of shown) {
      const key = startOfDay(new Date(it.at)).getTime()
      map.set(key, [...(map.get(key) ?? []), it])
    }
    return [...map.entries()]
  }, [shown])

  const submit = () => {
    const t = note.trim()
    if (!t || !onAddNote) return
    onAddNote(t)
    setNote('')
  }

  return (
    <div className={cx('text-sm', className)}>
      {onAddNote && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="mb-4 flex items-center gap-2"
        >
          {noteAuthor && <Avatar name={noteAuthor} kind="installer" />}
          <label htmlFor={inputId} className="sr-only">
            {L.notePlaceholder}
          </label>
          <input
            id={inputId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={L.notePlaceholder}
            className="h-9 min-w-0 flex-1 rounded-full border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-ink-muted/80 focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!note.trim()}
            className={cx(
              'h-9 shrink-0 rounded-full bg-primary px-3.5 text-sm font-semibold text-primary-contrast transition-opacity disabled:opacity-40',
              focusRing
            )}
          >
            {L.noteSubmit}
          </button>
        </form>
      )}

      {sorted.length === 0 && <p className="py-4 text-center text-ink-muted">{L.empty}</p>}

      <div className="space-y-4">
        {groups.map(([day, list]) => (
          <section key={day} aria-label={formatDayLabel(new Date(day), now)}>
            <h5 className="mb-2 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
              {formatDayLabel(new Date(day), now)}
            </h5>
            <ol className="relative">
              <AnimatePresence initial={false}>
                {list.map((it, i) => {
                  const d = new Date(it.at)
                  return (
                    <motion.li
                      key={it.id}
                      layout="position"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        ...spring,
                        opacity: { duration: duration.base, ease: ease.out },
                      }}
                      className="relative flex gap-3 pb-3 last:pb-0"
                    >
                      {i < list.length - 1 && (
                        <span
                          aria-hidden
                          className="absolute top-8 bottom-0 left-[13px] w-px bg-line"
                        />
                      )}
                      <Avatar
                        name={it.actor.name}
                        kind={it.actor.kind ?? 'installer'}
                        tone={it.tone}
                      />
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-ink">
                          <span className="font-semibold">{it.actor.name}</span> {it.action}
                          <time
                            dateTime={d.toISOString()}
                            title={d.toLocaleString('fr-FR', {
                              dateStyle: 'full',
                              timeStyle: 'short',
                            })}
                            className="ml-1.5 text-xs whitespace-nowrap text-ink-muted"
                          >
                            {formatRelativeFr(d, now)}
                          </time>
                        </p>
                        {it.detail && (
                          <div className="mt-1 rounded-md bg-surface-2/60 px-2.5 py-1.5 text-[13px] text-ink-muted">
                            {it.detail}
                          </div>
                        )}
                      </div>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ol>
          </section>
        ))}
      </div>

      {sorted.length > maxInitial && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className={cx(
            'mt-3 rounded-sm text-sm font-medium text-primary hover:underline',
            focusRing
          )}
        >
          {expanded ? L.less : L.more(sorted.length - maxInitial)}
        </button>
      )}
    </div>
  )
}

function Avatar({
  name,
  kind,
  tone,
}: {
  name: string
  kind: ActivityActorKind
  tone?: ActivityEntry['tone']
}) {
  return (
    <span className="relative shrink-0" aria-hidden>
      <span
        className={cx(
          'grid size-7 place-items-center rounded-full text-[10px] font-semibold',
          KIND_CLS[kind]
        )}
      >
        {kind === 'system' ? '⚙' : initials(name)}
      </span>
      {tone && tone !== 'neutral' && (
        <span
          className={cx(
            'absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-surface',
            tone === 'success' ? 'bg-success' : tone === 'warning' ? 'bg-warning' : 'bg-danger'
          )}
        />
      )}
    </span>
  )
}
