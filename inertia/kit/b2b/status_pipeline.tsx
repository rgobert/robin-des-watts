import { motion, useReducedMotion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { ActionButton } from '../components/action_button'
import { duration, ease } from '../motion'
import { cx } from '../utils'

export type PipelineStep = {
  id: string
  label: string
  /** Date réalisée (étapes passées) ou prévue (à venir), déjà formatée : « 3 oct. ». */
  date?: string
  /** Durée habituelle de l'étape, ex. « 4 à 6 sem. ». */
  estimate?: string
}

export type PipelineDelay = { days: number; reason?: string }

export type PipelineNextAction = {
  label: string
  owner: string
  /** Échéance lisible, ex. « avant jeudi ». */
  due?: string
  ctaLabel?: string
  onAction?: () => void | Promise<void>
}

type Status = 'done' | 'current' | 'todo'

/**
 * Suivi d'un dossier chantier par étapes : ce qui est fait, où on en est, le retard signalé (et pourquoi),
 * la prochaine action avec son responsable, et la date de fin estimée. `variant="compact"` pour une cellule de table.
 * Friction traitée : « on en est où sur le dossier Moreau ? » ; un coup de fil au bureau pour chaque client.
 */
export function StatusPipeline({
  steps,
  currentId,
  delay,
  nextAction,
  eta,
  variant = 'full',
  labels,
  className,
}: {
  steps: PipelineStep[]
  /** Étape en cours. Les précédentes sont faites, les suivantes à venir. Un id inconnu = tout est fait. */
  currentId: string
  delay?: PipelineDelay
  nextAction?: PipelineNextAction
  /** Fin estimée, ex. « Batterie virtuelle active vers le 20 nov. ». */
  eta?: ReactNode
  variant?: 'full' | 'compact'
  labels?: Partial<{
    late: (d: number) => string
    next: string
    owner: string
    done: string
    current: string
  }>
  className?: string
}) {
  const L = {
    late: (d: number) => `En retard de ${d} j`,
    next: 'Prochaine action',
    owner: 'Responsable',
    done: 'Terminé',
    current: 'En cours',
    ...labels,
  }
  const reduce = useReducedMotion()
  const idx = steps.findIndex((s) => s.id === currentId)
  const cur = idx < 0 ? steps.length : idx
  const statusOf = (i: number): Status => (i < cur ? 'done' : i === cur ? 'current' : 'todo')
  const late = !!delay && delay.days > 0
  const allDone = cur >= steps.length

  if (variant === 'compact') {
    const label = allDone ? L.done : steps[cur]?.label
    return (
      <div
        className={cx('min-w-28 sm:min-w-32', className)}
        title={`${label} · étape ${Math.min(cur + 1, steps.length)}/${steps.length}`}
      >
        <div className="flex gap-0.5" aria-hidden>
          {steps.map((s, i) => {
            const st = statusOf(i)
            return (
              <span
                key={s.id}
                className={cx(
                  'h-1.5 flex-1 rounded-full',
                  st === 'done' && 'bg-primary',
                  st === 'current' && (late ? 'bg-danger' : 'bg-primary/45'),
                  st === 'todo' && 'bg-surface-2'
                )}
              />
            )
          })}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs leading-tight sm:whitespace-nowrap">
          <span
            className={cx(
              'font-medium',
              late ? 'text-danger' : allDone ? 'text-success' : 'text-ink'
            )}
          >
            {label}
          </span>
          {late && <span className="text-danger">· +{delay!.days} j</span>}
        </p>
      </div>
    )
  }

  return (
    <div className={cx('space-y-5', className)}>
      {/* Horizontal dès 640 px */}
      <ol
        className="relative hidden sm:grid"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        aria-label="Étapes du dossier"
      >
        {/* Rail + remplissage (transform, pas width) */}
        <span
          aria-hidden
          className="absolute top-[13px] h-0.5 rounded-full bg-surface-2"
          style={{ left: `${50 / steps.length}%`, right: `${50 / steps.length}%` }}
        />
        <span
          aria-hidden
          className="absolute top-[13px] h-0.5"
          style={{ left: `${50 / steps.length}%`, right: `${50 / steps.length}%` }}
        >
          <motion.span
            className="block h-full origin-left rounded-full bg-primary"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: Math.min(cur, steps.length - 1) / Math.max(1, steps.length - 1) }}
            transition={reduce ? { duration: 0 } : { duration: duration.story, ease: ease.out }}
          />
        </span>
        {steps.map((s, i) => {
          const st = statusOf(i)
          return (
            <li
              key={s.id}
              className="relative flex flex-col items-center px-1 text-center"
              aria-current={st === 'current' ? 'step' : undefined}
            >
              <Node status={st} late={late && st === 'current'} index={i} />
              <p
                className={cx(
                  'mt-2 text-[13px] leading-tight',
                  st === 'todo' ? 'text-ink-muted' : 'font-medium text-ink'
                )}
              >
                {s.label}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {st === 'current' ? (s.estimate ?? L.current) : s.date}
              </p>
              {st === 'current' && late && <LateBadge text={L.late(delay!.days)} />}
            </li>
          )
        })}
      </ol>

      {/* Vertical sur mobile */}
      <ol className="relative space-y-3 sm:hidden" aria-label="Étapes du dossier">
        {steps.map((s, i) => {
          const st = statusOf(i)
          return (
            <li
              key={s.id}
              className="relative flex gap-3"
              aria-current={st === 'current' ? 'step' : undefined}
            >
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className={cx(
                    'absolute top-7 bottom-[-12px] left-[13px] w-0.5',
                    st === 'done' ? 'bg-primary' : 'bg-surface-2'
                  )}
                />
              )}
              <Node status={st} late={late && st === 'current'} index={i} />
              <div className="min-w-0 pt-1">
                <p
                  className={cx(
                    'text-sm leading-tight',
                    st === 'todo' ? 'text-ink-muted' : 'font-medium text-ink'
                  )}
                >
                  {s.label}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {st === 'current' ? (s.estimate ?? L.current) : s.date}
                </p>
                {st === 'current' && late && <LateBadge text={L.late(delay!.days)} align="left" />}
              </div>
            </li>
          )
        })}
      </ol>

      {late && delay?.reason && (
        <p className="flex gap-2 rounded-md border border-danger/25 bg-danger/[0.06] px-3 py-2 text-sm text-ink">
          <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden>
            <path
              d="M8 1.8l6.5 11.4H1.5z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M8 6.3v3.2M8 11.4v.1"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <span>{delay.reason}</span>
        </p>
      )}

      {(nextAction || eta) && (
        <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4 sm:flex-row sm:items-center">
          {nextAction && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">{L.next}</p>
              <p className="mt-1 font-medium text-ink">{nextAction.label}</p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {L.owner} : <span className="text-ink">{nextAction.owner}</span>
                {nextAction.due && <> · {nextAction.due}</>}
              </p>
              {eta && <p className="mt-2 text-sm text-ink-muted">{eta}</p>}
            </div>
          )}
          {!nextAction && eta && <p className="flex-1 text-sm text-ink-muted">{eta}</p>}
          {nextAction?.onAction && (
            <AsyncButton
              onRun={nextAction.onAction}
              label={nextAction.ctaLabel ?? nextAction.label}
            />
          )}
        </div>
      )}
    </div>
  )
}

/** ActionButton avec états gérés localement (chargement → succès → retour). */
function AsyncButton({ onRun, label }: { onRun: () => void | Promise<void>; label: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'success'>('idle')
  return (
    <ActionButton
      className="shrink-0"
      state={state}
      loadingLabel="En cours…"
      successLabel="Fait"
      onClick={async () => {
        setState('loading')
        await Promise.all([onRun(), new Promise((r) => setTimeout(r, 700))])
        setState('success')
        setTimeout(() => setState('idle'), 1600)
      }}
    >
      {label}
    </ActionButton>
  )
}

function Node({ status, late, index }: { status: Status; late: boolean; index: number }) {
  const reduce = useReducedMotion()
  return (
    <span className="relative z-[1] grid size-7 shrink-0 place-items-center">
      {status === 'current' && !reduce && (
        <motion.span
          aria-hidden
          className={cx('absolute inset-0 rounded-full', late ? 'bg-danger/25' : 'bg-primary/20')}
          animate={{ scale: [1, 1.45, 1], opacity: [0.9, 0, 0.9] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <span
        className={cx(
          'relative grid size-7 place-items-center rounded-full border-2 text-xs font-semibold',
          status === 'done' && 'border-primary bg-primary text-primary-contrast',
          status === 'current' &&
            (late
              ? 'border-danger bg-surface text-danger'
              : 'border-primary bg-surface text-primary'),
          status === 'todo' && 'border-line bg-surface text-ink-muted'
        )}
      >
        {status === 'done' ? (
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
            <path
              d="M3.5 8.5l3 3 6-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          index + 1
        )}
      </span>
      <span className="sr-only">
        {status === 'done'
          ? 'Terminé'
          : status === 'current'
            ? late
              ? 'En cours, en retard'
              : 'En cours'
            : 'À venir'}
      </span>
    </span>
  )
}

function LateBadge({ text, align = 'center' }: { text: string; align?: 'center' | 'left' }) {
  return (
    <span
      className={cx(
        'mt-1.5 inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-danger',
        align === 'center' && 'mx-auto'
      )}
    >
      <span className="size-1.5 rounded-full bg-danger" />
      {text}
    </span>
  )
}
