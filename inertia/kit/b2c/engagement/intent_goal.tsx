import { AnimatePresence, motion } from 'motion/react'
import { useId, useState } from 'react'
import { ActionButton } from '../../components/action_button'
import { useToast } from '../../components/toast'
import { duration, ease } from '../../motion'
import { cx } from '../../utils'
import { StatusPill, fmtEur, fmtNum } from './shared'

export type IntentStatus = 'planned' | 'running' | 'boost' | 'done'
export type Intent = {
  id: string
  kind: 'water' | 'ev'
  /** Verbe de l'intention : « Douche chaude », « Voiture ». */
  title: string
  /** Heure à laquelle ce doit être prêt, « HH:MM ». */
  time: string
  /** Niveau visé (°C ou %). */
  level: number
  unit: '°C' | '%'
  min: number
  max: number
  step: number
  /** Niveau actuel. */
  current: number
  /** kWh nécessaires par unité de niveau (ballon 200 L ≈ 0,23 kWh/°C ; VE 50 kWh = 0,5 kWh/%). */
  kwhPerUnit: number
  /** Prix du kWh planifié par Robin (soleil + batterie virtuelle) et prix « maintenant » (réseau). */
  plannedPrice: number
  nowPrice: number
  status: IntentStatus
  /** Ce que Robin a prévu, en clair. */
  plan: string
}

export const DEFAULT_INTENTS: Intent[] = [
  {
    id: 'shower',
    kind: 'water',
    title: 'Douche chaude',
    time: '07:00',
    level: 55,
    unit: '°C',
    min: 50,
    max: 65,
    step: 1,
    current: 44,
    kwhPerUnit: 0.23,
    plannedPrice: 0,
    nowPrice: 0.194,
    status: 'planned',
    plan: 'Robin chauffe demain entre 11h et 13h avec votre soleil. L’eau garde sa chaleur jusqu’au lendemain matin.',
  },
  {
    id: 'car',
    kind: 'ev',
    title: 'Voiture',
    time: '08:00',
    level: 80,
    unit: '%',
    min: 50,
    max: 100,
    step: 5,
    current: 42,
    kwhPerUnit: 0.5,
    plannedPrice: 0.05,
    nowPrice: 0.194,
    status: 'running',
    plan: 'En charge sur le surplus solaire (1,9 kW en ce moment). Le reste se fera cette nuit sur votre batterie virtuelle.',
  },
]

const STATUS_LABEL: Record<IntentStatus, string> = {
  planned: 'Planifié',
  running: 'En cours',
  boost: 'Maintenant (forcé)',
  done: 'Prêt',
}
const STATUS_TONE = {
  planned: 'neutral',
  running: 'solar',
  boost: 'warning',
  done: 'success',
} as const

/**
 * Objectifs par intention : « Douche chaude à 7h », « Voiture à 80 % à 8h ». L'utilisateur dit l'heure
 * et le niveau, Robin bâtit le planning (statut Planifié / En cours). Le bouton « Maintenant quand même »
 * affiche son coût réel (et l'écart avec le plan) AVANT de confirmer.
 * Friction traitée : on pense en besoins (« de l'eau chaude demain matin »), pas en horaires ; et forcer
 * une charge sans en connaître le prix est le manque avoué d'Intelligent Octopus.
 * Pattern : P16 (Intelligent Octopus Go, « ready by » + bump charge).
 */
export function IntentGoal({
  intents = DEFAULT_INTENTS,
  onChange,
  className,
}: {
  intents?: Intent[]
  onChange?: (intents: Intent[]) => void
  className?: string
}) {
  const [items, setItems] = useState(intents)
  const update = (id: string, patch: Partial<Intent>) =>
    setItems((xs) => {
      const next = xs.map((x) => (x.id === id ? { ...x, ...patch } : x))
      onChange?.(next)
      return next
    })
  return (
    <ul className={cx('grid gap-3', className)}>
      {items.map((it) => (
        <IntentCard key={it.id} intent={it} onUpdate={(p) => update(it.id, p)} />
      ))}
    </ul>
  )
}

function IntentCard({
  intent: it,
  onUpdate,
}: {
  intent: Intent
  onUpdate: (p: Partial<Intent>) => void
}) {
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [btn, setBtn] = useState<'idle' | 'loading' | 'success'>('idle')
  const timeId = useId()
  const levelId = useId()
  const kwh = Math.max(0, it.level - it.current) * it.kwhPerUnit
  const nowCost = kwh * it.nowPrice
  const plannedCost = kwh * it.plannedPrice
  const [hh, mm] = it.time.split(':')
  const hour = `${Number(hh)}h${mm && mm !== '00' ? mm : ''}`
  const sentence =
    it.kind === 'water' ? `${it.title} à ${hour}` : `${it.title} à ${it.level} % à ${hour}`

  const confirmBoost = () => {
    setBtn('loading')
    setTimeout(() => {
      setBtn('idle')
      setConfirming(false)
      const prev = it.status
      onUpdate({ status: 'boost' })
      toast({
        message: `${it.kind === 'water' ? 'Chauffe' : 'Charge'} lancée maintenant : environ ${fmtEur(nowCost)}.`,
        actionLabel: 'Annuler',
        onAction: () => onUpdate({ status: prev }),
      })
    }, 700)
  }

  return (
    <li className="rounded-lg border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-home"
            aria-hidden
          >
            {it.kind === 'water' ? (
              <svg viewBox="0 0 16 16" className="size-4">
                <path
                  d="M8 1.8C6 4.6 4.2 6.8 4.2 9.3a3.8 3.8 0 0 0 7.6 0C11.8 6.8 10 4.6 8 1.8z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" className="size-4">
                <path
                  d="M3 9.5l1.2-3.3A1.6 1.6 0 0 1 5.7 5h4.6a1.6 1.6 0 0 1 1.5 1.2L13 9.5V12h-1.5v-1h-7v1H3z"
                  fill="currentColor"
                />
              </svg>
            )}
          </span>
          <p className="font-display text-lg font-semibold text-ink">{sentence}</p>
        </div>
        <StatusPill
          tone={STATUS_TONE[it.status]}
          pulse={it.status === 'running' || it.status === 'boost'}
        >
          {STATUS_LABEL[it.status]}
        </StatusPill>
      </div>

      <p className="mt-2 text-sm text-ink-muted">
        {it.status === 'boost'
          ? `Lancé maintenant sur le réseau, prêt dans environ ${fmtNum(kwh / (it.kind === 'water' ? 2.2 : 7), 1).replace(',0', '')} h.`
          : it.plan}
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-3">
        <div>
          <label htmlFor={timeId} className="block text-xs text-ink-muted">
            Prêt à
          </label>
          <input
            id={timeId}
            type="time"
            value={it.time}
            step={900}
            onChange={(e) => e.target.value && onUpdate({ time: e.target.value })}
            className="mt-1 h-9 rounded-sm border border-line bg-surface px-2 text-sm text-ink tabular-nums focus-visible:outline-2 focus-visible:outline-primary"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor={levelId} className="flex justify-between text-xs text-ink-muted">
            <span>{it.kind === 'water' ? 'Température de l’eau' : 'Charge visée'}</span>
            <strong className="text-ink tabular-nums">
              {it.level} {it.unit}
            </strong>
          </label>
          <input
            id={levelId}
            type="range"
            min={it.min}
            max={it.max}
            step={it.step}
            value={it.level}
            onChange={(e) => onUpdate({ level: Number(e.target.value) })}
            className="mt-2 w-full accent-primary"
          />
        </div>
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <AnimatePresence mode="wait" initial={false}>
          {!confirming ? (
            <motion.div
              key="cta"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.fast }}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <p className="text-xs text-ink-muted tabular-nums">
                Planifié : {plannedCost < 0.005 ? '0 € (soleil)' : `≈ ${fmtEur(plannedCost)}`} ·{' '}
                {fmtNum(kwh, 1)} kWh
              </p>
              {it.status === 'boost' ? (
                <button
                  type="button"
                  onClick={() => onUpdate({ status: 'planned' })}
                  className="text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  Revenir au plan de Robin
                </button>
              ) : (
                <button
                  type="button"
                  disabled={kwh <= 0}
                  onClick={() => setConfirming(true)}
                  className="inline-flex h-9 items-center rounded-full border border-line px-4 text-sm font-medium text-ink hover:border-ink/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
                >
                  {kwh <= 0 ? 'Déjà prêt' : 'Maintenant quand même'}
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.fast, ease: ease.out }}
              role="group"
              aria-label="Confirmer le lancement immédiat"
            >
              <p className="text-sm text-ink">
                Lancer maintenant coûte environ{' '}
                <strong className="tabular-nums">{fmtEur(nowCost)}</strong> ({fmtNum(kwh, 1)} kWh au
                tarif réseau {fmtEur(it.nowPrice, 3)}), contre{' '}
                <strong className="tabular-nums">
                  {plannedCost < 0.005 ? '0 €' : fmtEur(plannedCost)}
                </strong>{' '}
                avec le plan de Robin.
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Soit {fmtEur(nowCost - plannedCost)} de plus. Vous pourrez revenir au plan à tout
                moment.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton
                  state={btn}
                  loadingLabel="Lancement…"
                  onClick={confirmBoost}
                  className="h-10"
                >
                  Lancer pour {fmtEur(nowCost)}
                </ActionButton>
                <ActionButton variant="ghost" className="h-10" onClick={() => setConfirming(false)}>
                  Garder le plan
                </ActionButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </li>
  )
}
