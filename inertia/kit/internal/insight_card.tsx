import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { WhyThis } from '../components/explain'
import { useToast } from '../components/toast'
import { duration, ease, pressable } from '../motion'
import { cx } from '../utils'
import { WARNING_TEXT } from './chart_utils'
import { OpsSparkline } from './kpi_tile'

export type InsightSeverity = 'critique' | 'attention' | 'info'

const SEVERITY: Record<
  InsightSeverity,
  { label: string; text: string; ring: string; icon: ReactNode }
> = {
  critique: {
    label: 'Critique',
    text: 'text-danger',
    ring: 'border-danger/40',
    icon: <path d="M6 1.5 11 10.5H1L6 1.5ZM6 5v2.4M6 8.9v.1" />,
  },
  attention: {
    label: 'À surveiller',
    text: WARNING_TEXT,
    ring: 'border-warning/40',
    icon: <path d="M6 1.2a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6ZM6 3.6v3M6 8.3v.1" />,
  },
  info: {
    label: 'Information',
    text: 'text-primary',
    ring: 'border-line',
    icon: <path d="M6 1.2a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6ZM6 5.4v3M6 3.6v.1" />,
  },
}

/** Pastille de gravité : icône + libellé (jamais la couleur seule). */
export function SeverityBadge({ severity, label }: { severity: InsightSeverity; label?: string }) {
  const s = SEVERITY[severity]
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border bg-surface px-2 py-0.5 text-xs font-semibold',
        s.text,
        s.ring
      )}
    >
      <svg
        viewBox="0 0 12 12"
        className="size-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {s.icon}
      </svg>
      {label ?? s.label}
    </span>
  )
}

/**
 * Insight produit / anomalie détectée : constat chiffré, gravité, métrique liée avec sa tendance,
 * « Pourquoi ? » dépliable (hypothèses de détection), actions directes avec annulation par toast.
 * Friction traitée : une anomalie repérée dans un dashboard meurt dans un message Slack ; ici elle devient une tâche ou un filtre en un clic.
 */
export function InsightCard({
  severity = 'attention',
  title,
  detectedAt,
  metric,
  why,
  whySource,
  whyTitle = 'Pourquoi ?',
  onCreateTask,
  onDismiss,
  onViewAccounts,
  viewAccountsLabel = 'Voir les comptes',
  createTaskLabel = 'Créer une tâche',
  dismissLabel = 'Ignorer',
  taskRef = 'PROD-142',
  className,
}: {
  severity?: InsightSeverity
  title: ReactNode
  detectedAt?: string
  metric?: {
    label: string
    value: string
    delta?: string
    spark?: number[]
    goodDirection?: 'up' | 'down'
  }
  why?: { label: string; value: string }[]
  whySource?: string
  whyTitle?: string
  /** Appelé à la création (et avec `undo = true` si l'utilisateur annule). */
  onCreateTask?: (undo?: boolean) => void
  onDismiss?: (undo?: boolean) => void
  onViewAccounts?: () => void
  viewAccountsLabel?: string
  createTaskLabel?: string
  dismissLabel?: string
  /** Référence affichée une fois la tâche créée. */
  taskRef?: string
  className?: string
}) {
  const toast = useToast()
  const reduce = useReducedMotion()
  const [task, setTask] = useState(false)
  const [hidden, setHidden] = useState(false)
  const s = SEVERITY[severity]

  const createTask = () => {
    setTask(true)
    onCreateTask?.()
    toast({
      message: `Tâche ${taskRef} créée et assignée à l'équipe produit.`,
      tone: 'success',
      actionLabel: 'Annuler',
      onAction: () => {
        setTask(false)
        onCreateTask?.(true)
      },
    })
  }
  const dismiss = () => {
    setHidden(true)
    onDismiss?.()
    toast({
      message: 'Insight ignoré. Il ne remontera plus cette semaine.',
      actionLabel: 'Annuler',
      onAction: () => {
        setHidden(false)
        onDismiss?.(true)
      },
    })
  }

  return (
    <AnimatePresence initial={false}>
      {!hidden && (
        <motion.article
          initial={reduce ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
          transition={{ duration: duration.base, ease: ease.out }}
          className={cx(
            'overflow-hidden rounded-md border bg-surface shadow-card',
            s.ring,
            className
          )}
        >
          <div className="flex gap-4 p-4 sm:p-5">
            <span
              className={cx(
                'mt-1 hidden w-1 shrink-0 self-stretch rounded-full sm:block',
                severity === 'critique'
                  ? 'bg-danger'
                  : severity === 'attention'
                    ? 'bg-warning'
                    : 'bg-primary'
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={severity} />
                {detectedAt && <span className="text-xs text-ink-muted">Détecté {detectedAt}</span>}
                {task && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                    <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                      <path
                        d="M2.5 6.2 5 8.5l4.5-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {taskRef}
                  </span>
                )}
              </div>
              <h4 className="mt-2 text-base leading-snug font-semibold text-ink sm:text-lg">
                {title}
              </h4>

              {metric && (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-sm bg-surface-2/50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs text-ink-muted">{metric.label}</p>
                    <p className="text-lg font-semibold text-ink">
                      {metric.value}
                      {metric.delta && (
                        <span className="ml-2 text-sm font-semibold text-danger tabular-nums">
                          {metric.delta}
                        </span>
                      )}
                    </p>
                  </div>
                  {metric.spark && (
                    <OpsSparkline
                      values={metric.spark}
                      width={140}
                      height={34}
                      tone="danger"
                      label={`Tendance ${metric.label} sur ${metric.spark.length} jours`}
                    />
                  )}
                </div>
              )}

              {why && (
                <WhyThis className="mt-3" title={whyTitle} hypotheses={why} source={whySource} />
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <motion.button
                  type="button"
                  {...pressable}
                  onClick={task ? undefined : createTask}
                  disabled={task}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-contrast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
                >
                  {task ? 'Tâche créée' : createTaskLabel}
                </motion.button>
                {onViewAccounts && (
                  <motion.button
                    type="button"
                    {...pressable}
                    onClick={onViewAccounts}
                    className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {viewAccountsLabel}
                  </motion.button>
                )}
                <button
                  type="button"
                  onClick={dismiss}
                  className="rounded-full px-3 py-2 text-sm text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {dismissLabel}
                </button>
              </div>
            </div>
          </div>
        </motion.article>
      )}
    </AnimatePresence>
  )
}
