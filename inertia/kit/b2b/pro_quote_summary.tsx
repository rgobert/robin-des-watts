import { AnimatePresence, motion } from 'motion/react'
import { useId, useState, type ReactNode } from 'react'
import { ActionButton } from '../components/action_button'
import { AnimatedNumber } from '../components/animated_number'
import { WhyThis } from '../components/explain'
import { duration, ease, fadeUp, stagger } from '../motion'
import { cx } from '../utils'
import { focusRing } from './shared'
import { useToast } from '../components/toast'

export type QuoteEquipment = { label: string; detail?: string; qty?: number }

type Labels = {
  title: string
  equipment: string
  offer: string
  recommended: string
  monthly: string
  savings: string
  perYear: string
  send: string
  sending: string
  sent: string
  print: string
  copy: string
  validity: string
}

const DEFAULT_LABELS: Labels = {
  title: 'Votre projet solaire piloté',
  equipment: 'Votre installation',
  offer: 'Offre recommandée',
  recommended: 'Recommandée pour vous',
  monthly: 'par mois TTC',
  savings: 'Économies estimées',
  perYear: 'par an',
  send: 'Envoyer au client',
  sending: 'Envoi…',
  sent: 'Envoyé',
  print: 'Imprimer / PDF',
  copy: 'Copier le lien',
  validity: 'Proposition valable 30 jours',
}

/**
 * Récapitulatif de devis / dimensionnement à montrer au client final : installation, offre recommandée AVEC sa raison,
 * mensualité, économies estimées (et leurs hypothèses), CTA « Envoyer au client ». Imprimable tel quel (seul le devis
 * sort à l'impression, sans les boutons).
 * Friction traitée : le devis tableur illisible pour le client ; l'installateur réexplique tout au téléphone.
 */
export function ProQuoteSummary({
  client,
  installer,
  reference,
  date,
  equipment,
  offer,
  savings,
  notes,
  onSend,
  onCopyLink,
  sentTo,
  labels: labelsProp,
  className,
}: {
  client: { name: string; address?: string }
  installer?: { name: string; contact?: string }
  reference?: string
  /** Date lisible, ex. « 14 octobre 2026 ». */
  date?: string
  equipment: QuoteEquipment[]
  offer: {
    name: string
    reason: ReactNode
    monthly: number
    unitNote?: string
    included?: string[]
  }
  savings: {
    yearly: number
    note?: string
    hypotheses?: { label: string; value: string }[]
    source?: string
  }
  notes?: string
  onSend?: () => void | Promise<void>
  onCopyLink?: () => void
  /** Affiché après envoi, ex. l'e-mail du client. */
  sentTo?: string
  labels?: Partial<Labels>
  className?: string
}) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp }
  const [state, setState] = useState<'idle' | 'loading' | 'success'>('idle')
  const toast = useToast()
  const printId = useId().replace(/:/g, '')

  const send = async () => {
    setState('loading')
    try {
      await Promise.all([onSend?.(), new Promise((r) => setTimeout(r, 900))])
      setState('success')
    } catch {
      setState('idle')
      toast({
        message: 'Envoi impossible pour le moment. Vérifiez votre connexion puis réessayez.',
      })
    }
  }

  return (
    <div className={className}>
      {/* À l'impression : uniquement ce devis, sans ombres ni boutons. */}
      <style>{`@media print {
        body * { visibility: hidden !important; }
        [data-quote-print="${printId}"], [data-quote-print="${printId}"] * { visibility: visible !important; }
        [data-quote-print="${printId}"] { position: absolute; inset: 0 auto auto 0; width: 100%; box-shadow: none !important; border: 0 !important; }
      }`}</style>

      <motion.article
        data-quote-print={printId}
        variants={stagger(0.06)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="overflow-hidden rounded-lg border border-line bg-surface shadow-card"
      >
        <motion.header
          variants={fadeUp}
          className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-surface-2/50 px-5 py-4 sm:px-6"
        >
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
              {labels.title}
            </p>
            <p className="mt-1 font-display text-2xl text-ink">{client.name}</p>
            {client.address && <p className="text-sm text-ink-muted">{client.address}</p>}
          </div>
          <div className="text-right text-xs text-ink-muted">
            {reference && <p className="font-medium text-ink">{reference}</p>}
            {date && <p>{date}</p>}
            {installer && (
              <p className="mt-1">
                {installer.name}
                {installer.contact && <> · {installer.contact}</>}
              </p>
            )}
          </div>
        </motion.header>

        <div className="grid gap-0 md:grid-cols-[1fr_1.15fr]">
          <motion.section
            variants={fadeUp}
            className="border-b border-line px-5 py-5 sm:px-6 md:border-r md:border-b-0"
          >
            <h4 className="text-sm font-semibold text-ink">{labels.equipment}</h4>
            <ul className="mt-3 divide-y divide-line">
              {equipment.map((e) => (
                <li key={e.label} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block text-ink">{e.label}</span>
                    {e.detail && <span className="block text-xs text-ink-muted">{e.detail}</span>}
                  </span>
                  {e.qty !== undefined && (
                    <span className="shrink-0 text-ink-muted tabular-nums">× {e.qty}</span>
                  )}
                </li>
              ))}
            </ul>
            {notes && <p className="mt-3 text-xs text-ink-muted">{notes}</p>}
          </motion.section>

          <motion.section variants={fadeUp} className="px-5 py-5 sm:px-6">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-ink">{labels.offer}</h4>
              <span className="rounded-full bg-reward/10 px-2.5 py-0.5 text-[11px] font-semibold text-reward">
                {labels.recommended}
              </span>
            </div>
            <p className="mt-2 font-display text-xl text-ink">{offer.name}</p>
            <p className="mt-1 text-sm text-ink">{offer.reason}</p>
            {offer.included && (
              <ul className="mt-3 space-y-1 text-sm text-ink-muted">
                {offer.included.map((i) => (
                  <li key={i} className="flex gap-2">
                    <svg
                      viewBox="0 0 16 16"
                      className="mt-0.5 size-4 shrink-0 text-success"
                      aria-hidden
                    >
                      <path
                        d="M3.5 8.5l3 3 6-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {i}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-md border border-line p-3">
                <p className="text-xs text-ink-muted">Mensualité</p>
                <p className="mt-1 font-display text-2xl font-semibold text-ink">
                  <AnimatedNumber value={offer.monthly} decimals={2} suffix=" €" />
                </p>
                <p className="text-xs text-ink-muted">{offer.unitNote ?? labels.monthly}</p>
              </div>
              <div className="rounded-md border border-reward/30 bg-reward/[0.06] p-3">
                <p className="text-xs text-ink-muted">{labels.savings}</p>
                <p className="mt-1 font-display text-2xl font-semibold text-reward">
                  <AnimatedNumber value={savings.yearly} suffix=" €" />
                </p>
                <p className="text-xs text-ink-muted">{savings.note ?? labels.perYear}</p>
              </div>
            </div>
            {savings.hypotheses && (
              <WhyThis className="mt-3" hypotheses={savings.hypotheses} source={savings.source} />
            )}
          </motion.section>
        </div>

        <motion.footer
          variants={fadeUp}
          className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:px-6"
        >
          <p className="flex-1 text-xs text-ink-muted">
            {labels.validity} · Estimation non contractuelle.
          </p>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className={cx(
                'h-11 rounded-full px-4 text-sm font-medium text-primary hover:bg-primary/5',
                focusRing
              )}
            >
              {labels.print}
            </button>
            {onCopyLink && (
              <button
                type="button"
                onClick={onCopyLink}
                className={cx(
                  'h-11 rounded-full border border-line px-4 text-sm font-medium text-ink hover:border-ink/30',
                  focusRing
                )}
              >
                {labels.copy}
              </button>
            )}
            <ActionButton
              state={state}
              loadingLabel={labels.sending}
              successLabel={labels.sent}
              onClick={send}
            >
              {labels.send}
            </ActionButton>
          </div>
        </motion.footer>
        <AnimatePresence>
          {state === 'success' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: duration.base, ease: ease.out }}
              className="overflow-hidden print:hidden"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-success/25 bg-success/[0.07] px-5 py-3 text-sm sm:px-6">
                <span className="size-2 rounded-full bg-success" aria-hidden />
                <span className="text-ink">
                  Proposition envoyée
                  {sentTo ? (
                    <>
                      {' '}
                      à <strong className="font-semibold">{sentTo}</strong>
                    </>
                  ) : null}
                  . Vous serez prévenu à l’ouverture et à la signature.
                </span>
                <button
                  type="button"
                  onClick={() => setState('idle')}
                  className={cx(
                    'ml-auto rounded-sm text-sm font-medium text-primary hover:underline',
                    focusRing
                  )}
                >
                  Renvoyer
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.article>
    </div>
  )
}
