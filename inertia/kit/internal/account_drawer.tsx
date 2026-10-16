import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { duration, ease, softSpring } from '../motion'
import { cx, formatEuro } from '../utils'
import { WARNING_BG, WARNING_TEXT, fmtDateLong } from './chart_utils'
import { OFFERS, type AccountStatus, type CustomerAccount, type TimelineEvent } from './mocks'

export const ACCOUNT_STATUS: Record<AccountStatus, { label: string; dot: string; text: string }> = {
  actif: { label: 'Actif', dot: 'bg-success', text: 'text-success' },
  activation: { label: 'En activation', dot: 'bg-battery', text: 'text-ink' },
  impaye: { label: 'Impayé', dot: 'bg-danger', text: 'text-danger' },
  resilie: { label: 'Résilié', dot: 'bg-grid', text: 'text-ink-muted' },
  suspendu: { label: 'Suspendu', dot: 'bg-warning', text: WARNING_TEXT },
}

/** Badge de statut de compte : pastille + libellé (lisible sans la couleur). */
export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const s = ACCOUNT_STATUS[status]
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        s.text
      )}
    >
      <span className={cx('size-1.5 rounded-full', s.dot)} aria-hidden />
      {s.label}
    </span>
  )
}

/**
 * Confirmation inline d'une suspension (pas de modale) : on explique la conséquence, on confirme sur place.
 * Friction traitée : les modales « Êtes-vous sûr ? » sont validées par réflexe ; ici la conséquence est écrite à côté du bouton.
 */
export function SuspendConfirm({
  name,
  onConfirm,
  onCancel,
}: {
  name: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <div
      role="alertdialog"
      aria-label={`Suspendre le compte de ${name}`}
      className="flex flex-wrap items-center gap-3 rounded-sm border border-warning/40 bg-warning/5 px-3 py-2.5 text-sm"
    >
      <p className="min-w-0 flex-1 text-ink">
        Suspendre <strong className="font-semibold">{name}</strong> ? Le pilotage Robin s’arrête et
        la facturation est gelée.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-3 py-1.5 text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
        >
          Annuler
        </button>
        <button
          ref={ref}
          type="button"
          onClick={onConfirm}
          className={cx(
            'rounded-full px-3 py-1.5 font-medium text-primary-contrast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning',
            WARNING_BG
          )}
        >
          Confirmer la suspension
        </button>
      </div>
    </div>
  )
}

/**
 * Remboursement inline : montant pré-rempli (dernière facture) et motif.
 * Friction traitée : chercher le montant de la dernière facture dans un autre outil avant de rembourser.
 */
export function RefundForm({
  defaultAmount,
  onSubmit,
  onCancel,
}: {
  defaultAmount: number
  onSubmit: (amount: number, reason: string) => void
  onCancel: () => void
}) {
  const [amount, setAmount] = useState(
    defaultAmount ? defaultAmount.toFixed(2).replace('.', ',') : ''
  )
  const errId = useId()
  const [reason, setReason] = useState('Geste commercial')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])
  // L-POSTEL : « 27,40 », « 27.40 », « 27,40 € » sont acceptés
  const value = Number(amount.replace(/[\s€]/g, '').replace(',', '.'))
  const ok = Number.isFinite(value) && value > 0 && value <= 500
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (ok) onSubmit(value, reason)
      }}
      className="flex flex-wrap items-end gap-3 rounded-sm border border-line bg-surface-2/50 px-3 py-2.5 text-sm"
    >
      <label className="text-xs text-ink-muted">
        Montant (€)
        <input
          ref={ref}
          inputMode="decimal"
          value={amount}
          aria-invalid={!ok && amount !== ''}
          aria-describedby={!ok && amount !== '' ? errId : undefined}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 block w-24 rounded-sm border border-line bg-surface px-2 py-1.5 text-sm text-ink tabular-nums"
        />
      </label>
      <label className="min-w-0 flex-1 text-xs text-ink-muted">
        Motif
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 block w-full rounded-sm border border-line bg-surface px-2 py-1.5 text-sm text-ink"
        >
          <option>Geste commercial</option>
          <option>Erreur de facturation</option>
          <option>Retard de mise en service</option>
          <option>Coffret Robin défectueux</option>
        </select>
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-3 py-1.5 text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={!ok}
          className="rounded-full bg-primary px-3 py-1.5 font-medium text-primary-contrast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40"
        >
          {ok ? `Rembourser ${formatEuro(value, 2)}` : 'Rembourser'}
        </button>
      </div>
      {!ok && amount !== '' && (
        <p id={errId} className="w-full text-xs text-danger">
          Saisissez un montant entre 0,01 € et 500 € (au-delà, passez par la finance).
        </p>
      )}
    </form>
  )
}

const TONE_DOT: Record<NonNullable<TimelineEvent['tone']>, string> = {
  neutral: 'bg-ink-muted',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

/**
 * Panneau latéral de détail d'un compte : statut, chiffres clés, timeline, actions support.
 * Friction traitée : ouvrir 4 onglets (CRM, facturation, supervision Robin, Enedis) pour comprendre un seul client.
 * Échap ferme, le focus revient sur la ligne d'origine.
 */
export function AccountDrawer({
  account,
  onClose,
  onImpersonate,
  onSuspend,
  onReactivate,
  onRefund,
  offerLabels = Object.fromEntries(Object.entries(OFFERS).map(([k, v]) => [k, v.label])),
}: {
  account: CustomerAccount | null
  onClose: () => void
  onImpersonate?: (a: CustomerAccount) => void
  onSuspend?: (a: CustomerAccount) => void
  onReactivate?: (a: CustomerAccount) => void
  onRefund?: (a: CustomerAccount, amount: number, reason: string) => void
  offerLabels?: Record<string, string>
}) {
  const reduce = useReducedMotion()
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const [mode, setMode] = useState<'idle' | 'suspend' | 'refund'>('idle')
  const open = !!account
  // À l'ouverture : on repart du mode lecture.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setMode('idle')
  }
  const closeCb = useRef(onClose)
  const modeRef = useRef(mode)
  useLayoutEffect(() => {
    closeCb.current = onClose
    modeRef.current = mode
  })

  useEffect(() => {
    if (!open) return
    opener.current = document.activeElement as HTMLElement
    const t = setTimeout(() => closeRef.current?.focus(), 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Échap annule d'abord la confirmation / le remboursement en cours, puis ferme le panneau
        if (modeRef.current !== 'idle') setMode('idle')
        else closeCb.current()
        return
      }
      // aria-modal : le focus reste dans le panneau (Tab / Maj+Tab bouclent)
      if (e.key !== 'Tab' || !panelRef.current) return
      const f = [
        ...panelRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, select, a[href], [tabindex="0"]'
        ),
      ]
      if (!f.length) return
      const first = f[0]!
      const last = f[f.length - 1]!
      const inside = panelRef.current.contains(document.activeElement)
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      opener.current?.focus?.()
    }
  }, [open])

  // Retour à l'état normal (Annuler, Échap, confirmation) : le focus ne retombe pas sur <body>
  useEffect(() => {
    if (mode === 'idle' && panelRef.current && !panelRef.current.contains(document.activeElement))
      closeRef.current?.focus()
  }, [mode])

  return (
    <AnimatePresence>
      {account && (
        <>
          <motion.div
            key="scrim"
            className="fixed inset-0 z-40 bg-ink/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast }}
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Compte ${account.name}`}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-canvas shadow-card"
            initial={reduce ? { opacity: 0 } : { x: '100%' }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={
              reduce
                ? { opacity: 0 }
                : { x: '100%', transition: { duration: duration.base, ease: ease.inOut } }
            }
            transition={reduce ? { duration: duration.fast } : softSpring}
          >
            <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs text-ink-muted tabular-nums">
                  {account.id} · {account.city}
                </p>
                <h3 className="mt-0.5 truncate font-display text-xl font-semibold">
                  {account.name}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <AccountStatusBadge status={account.status} />
                  <span className="text-xs text-ink-muted">{offerLabels[account.offer]}</span>
                </div>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Fermer le détail du compte"
                className="rounded-full p-2 text-ink-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
              >
                <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line text-sm">
                {[
                  ['MRR', formatEuro(account.mrr, 2)],
                  ['Solde', formatEuro(account.balance, 2)],
                  ['Installation', `${account.kwc.toLocaleString('fr-FR')} kWc`],
                  ['Coffret Robin', account.robin],
                  ['Mode Smart', account.smart ? 'Activé' : 'Inactif'],
                  ['Client depuis', fmtDateLong(account.since)],
                ].map(([k, v]) => (
                  <div key={k} className="bg-surface px-3 py-2.5">
                    <dt className="text-xs text-ink-muted">{k}</dt>
                    <dd
                      className={cx(
                        'mt-0.5 font-medium text-ink tabular-nums',
                        k === 'Solde' && account.balance < 0 && 'text-danger'
                      )}
                    >
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs text-ink-muted">
                Installateur : {account.installer} · {account.email}
              </p>

              <h4 className="mt-6 text-sm font-semibold">Historique</h4>
              <ol className="relative mt-3 space-y-4 border-l border-line pl-5">
                {account.timeline.map((ev, i) => (
                  <motion.li
                    key={`${ev.date}-${ev.label}`}
                    className="relative"
                    initial={reduce ? false : { opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: duration.base,
                      ease: ease.out,
                      delay: reduce ? 0 : 0.12 + i * 0.04,
                    }}
                  >
                    <span
                      className={cx(
                        'absolute top-1.5 -left-[24.5px] size-2 rounded-full ring-2 ring-canvas',
                        TONE_DOT[ev.tone ?? 'neutral']
                      )}
                      aria-hidden
                    />
                    <p className="text-xs text-ink-muted tabular-nums">{fmtDateLong(ev.date)}</p>
                    <p className="text-sm text-ink">{ev.label}</p>
                  </motion.li>
                ))}
              </ol>
            </div>

            <footer className="space-y-3 border-t border-line px-5 py-4">
              {mode === 'suspend' && (
                <SuspendConfirm
                  name={account.name}
                  onCancel={() => setMode('idle')}
                  onConfirm={() => {
                    setMode('idle')
                    onSuspend?.(account)
                  }}
                />
              )}
              {mode === 'refund' && (
                <RefundForm
                  defaultAmount={account.mrr}
                  onCancel={() => setMode('idle')}
                  onSubmit={(amount, reason) => {
                    setMode('idle')
                    onRefund?.(account, amount, reason)
                  }}
                />
              )}
              {mode === 'idle' && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onImpersonate?.(account)}
                    className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-contrast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Se connecter en tant que
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('refund')}
                    className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-ink-muted"
                  >
                    Rembourser
                  </button>
                  {account.status === 'suspendu' ? (
                    <button
                      type="button"
                      onClick={() => onReactivate?.(account)}
                      className="rounded-full px-3 py-2 text-sm font-medium text-success hover:bg-success/10"
                    >
                      Réactiver
                    </button>
                  ) : (
                    account.status !== 'resilie' && (
                      <button
                        type="button"
                        onClick={() => setMode('suspend')}
                        className={cx(
                          'rounded-full px-3 py-2 text-sm font-medium hover:bg-warning/10 focus-visible:outline-2 focus-visible:outline-primary',
                          WARNING_TEXT
                        )}
                      >
                        Suspendre
                      </button>
                    )
                  )}
                </div>
              )}
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
