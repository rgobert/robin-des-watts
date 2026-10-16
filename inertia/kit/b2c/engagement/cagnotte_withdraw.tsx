import { AnimatePresence, motion } from 'motion/react'
import { useId, useState } from 'react'
import { ActionButton } from '../../components/action_button'
import { AnimatedNumber } from '../../components/animated_number'
import { useToast } from '../../components/toast'
import { duration, ease } from '../../motion'
import { cx } from '../../utils'
import { fmtEur } from './shared'

type Step = { id: string; label: string; detail: string }
type Labels = {
  title: string
  thresholdNote: string
  withdraw: string
  withdrawing: string
  belowThreshold: string
  to: string
}
const DEFAULT_LABELS: Labels = {
  title: 'Ma cagnotte',
  thresholdNote: 'Virement possible dès',
  withdraw: 'Virer sur mon compte',
  withdrawing: 'Virement…',
  belowThreshold: 'avant votre prochain virement',
  to: 'Vers',
}
const STEPS: Step[] = [
  { id: 'asked', label: 'Demandé', detail: 'Aujourd’hui' },
  { id: 'sent', label: 'Envoyé', detail: 'Demain' },
  { id: 'received', label: 'Reçu', detail: 'Sous 2 à 3 jours ouvrés' },
]

/**
 * Cagnotte virable avec un seuil bas (dès 10 €) : solde animé, progression vers le seuil,
 * choix du montant, virement avec états (chargement, suivi en 3 étapes) et toast d'annulation.
 * Friction traitée : une récompense qu'on ne peut pas toucher n'est pas réelle ; un seuil haut
 * (50, 100 €) repousse le premier virement de plusieurs mois et casse la boucle de motivation.
 * Pattern : P11 (Hello Watt, cagnotte virable dès 10 €).
 */
export function CagnotteWithdraw({
  balance: balanceProp = 23.85,
  threshold = 10,
  account = 'FR76 •••• •••• 4521',
  onWithdraw,
  labels: labelsProp,
  className,
}: {
  /** Solde disponible (€). */
  balance?: number
  /** Seuil minimal de virement (€). */
  threshold?: number
  /** Compte de destination, déjà masqué (affichage seulement). */
  account?: string
  /** Appel réel ; peut renvoyer une promesse. */
  onWithdraw?: (amount: number) => void | Promise<void>
  labels?: Partial<Labels>
  className?: string
}) {
  const L = { ...DEFAULT_LABELS, ...labelsProp }
  const toast = useToast()
  const [balance, setBalance] = useState(balanceProp)
  const [amount, setAmount] = useState(balanceProp)
  const [state, setState] = useState<'idle' | 'loading' | 'success'>('idle')
  const [transfer, setTransfer] = useState<{ amount: number; step: number } | null>(null)
  const sliderId = useId()

  const canWithdraw = balance >= threshold
  const pct = Math.min(100, (balance / threshold) * 100)
  const amt = Math.min(Math.max(amount, threshold), balance)

  const go = async () => {
    setState('loading')
    await Promise.all([onWithdraw?.(amt), new Promise((r) => setTimeout(r, 1100))])
    const before = balance
    setState('success')
    setBalance(+(before - amt).toFixed(2))
    setTransfer({ amount: amt, step: 0 })
    setTimeout(() => setTransfer((t) => (t ? { ...t, step: 1 } : t)), 1600)
    toast({
      message: `Virement de ${fmtEur(amt)} demandé.`,
      tone: 'success',
      actionLabel: 'Annuler',
      onAction: () => {
        setBalance(before)
        setAmount(before)
        setTransfer(null)
        setState('idle')
        toast({
          message: 'Virement annulé, le montant est revenu dans la cagnotte.',
          duration: 2500,
        })
      },
    })
    setTimeout(() => setState('idle'), 1400)
  }

  return (
    <div className={cx('rounded-lg border border-line bg-surface p-5 shadow-card', className)}>
      <p className="text-sm text-ink-muted">{L.title}</p>
      <p className="mt-1 font-display text-4xl font-semibold text-ink">
        <AnimatedNumber value={balance} decimals={2} suffix=" €" />
      </p>

      <div className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs text-ink-muted">
          <span>
            {L.thresholdNote} {fmtEur(threshold, 0)}
          </span>
          {!canWithdraw && (
            <span className="font-medium text-ink">
              Plus que {fmtEur(threshold - balance)} {L.belowThreshold}
            </span>
          )}
        </div>
        <div
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label="Progression vers le seuil de virement"
          aria-valuemin={0}
          aria-valuemax={threshold}
          aria-valuenow={Math.min(balance, threshold)}
        >
          <motion.div
            className="h-full rounded-full bg-reward"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: duration.story, ease: ease.out }}
          />
        </div>
      </div>

      {canWithdraw && !transfer && (
        <div className="mt-5">
          {balance > threshold && (
            <div>
              <label
                htmlFor={sliderId}
                className="flex items-baseline justify-between text-sm text-ink"
              >
                <span>Montant</span>
                <strong className="tabular-nums">{fmtEur(amt)}</strong>
              </label>
              <input
                id={sliderId}
                type="range"
                min={threshold}
                max={balance}
                step={0.05}
                value={amt}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-1 w-full accent-primary"
              />
              <div className="flex justify-between text-[11px] text-ink-muted tabular-nums">
                <span>{fmtEur(threshold, 0)}</span>
                <button
                  type="button"
                  onClick={() => setAmount(balance)}
                  className="font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  Tout virer ({fmtEur(balance)})
                </button>
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-ink-muted">
            {L.to} {account} · gratuit · annulable juste après
          </p>
          <ActionButton
            className="mt-3 w-full sm:w-auto"
            state={state}
            loadingLabel={L.withdrawing}
            successLabel="Demandé"
            onClick={go}
          >
            {L.withdraw} · {fmtEur(amt)}
          </ActionButton>
        </div>
      )}

      <AnimatePresence initial={false}>
        {transfer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: duration.base, ease: ease.out }}
            className="overflow-hidden"
          >
            <p className="mt-5 text-sm font-medium text-ink">
              Virement de {fmtEur(transfer.amount)} vers {account}
            </p>
            <ol className="mt-3 grid grid-cols-3 gap-2" aria-label="Suivi du virement">
              {STEPS.map((s, i) => {
                const done = i <= transfer.step
                return (
                  <li
                    key={s.id}
                    className="min-w-0"
                    aria-current={i === transfer.step ? 'step' : undefined}
                  >
                    <div className="h-1 rounded-full bg-surface-2">
                      <motion.div
                        className="h-full rounded-full bg-reward"
                        initial={false}
                        animate={{ width: done ? '100%' : '0%' }}
                        transition={{ duration: duration.slow, ease: ease.out }}
                      />
                    </div>
                    <p
                      className={cx(
                        'mt-2 text-xs font-semibold',
                        done ? 'text-ink' : 'text-ink-muted'
                      )}
                    >
                      {s.label}
                    </p>
                    <p className="text-[11px] leading-tight text-ink-muted">{s.detail}</p>
                  </li>
                )
              })}
            </ol>
            <button
              type="button"
              onClick={() => setTransfer(null)}
              className="mt-4 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              Fermer le suivi
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
