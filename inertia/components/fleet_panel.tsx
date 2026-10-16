import { AnimatePresence, motion } from 'motion/react'
import { AnimatedNumber } from '~/kit'
import { duration, ease, fadeUp, softSpring } from '~/kit/motion'

/** Mirrors FleetSnapshot from app/services/fleet_simulation_service.ts. */
export type Fleet = {
  label: string
  kpis: { exposed: number; activations: number; compensatedEur: number; winnersRate: number }
  activationsTrend: number[]
  feed: {
    prenom: string
    ville: string
    type: 'hausse_vue' | 'activation_demandee' | 'bascule_gagnante'
    eur: number
    at: number
  }[]
}

const EUR = new Intl.NumberFormat('fr-FR')

/**
 * Teinte qui s'efface sur 600 ms quand la valeur d'une tuile KPI change.
 * Friction traitée : sur grand écran, l'œil ne voit pas quel chiffre vient de bouger.
 * AnimatePresence initial={false} : rien au montage ni aux polls sans changement, flash seulement sur nouvelle clé.
 */
export function KpiFlash({ value }: { value: number }) {
  return (
    <AnimatePresence initial={false}>
      <motion.span
        key={value}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-md bg-primary/10 ring-2 ring-inset ring-primary/30"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6, ease: ease.out }}
      />
    </AnimatePresence>
  )
}

/** Nouvel item de flux : glisse depuis le haut, les anciens descendent (layout), sortie en fondu. */
export const feedItem = {
  layout: 'position',
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: duration.base, ease: ease.out },
} as const

function describe({ type, eur }: Fleet['feed'][number]) {
  switch (type) {
    case 'hausse_vue':
      return `découvre sa hausse du 1er novembre (+${EUR.format(eur)} €/an)`
    case 'activation_demandee':
      return `demande l’activation de MySmartPilot (+${EUR.format(eur)} €/an)`
    case 'bascule_gagnante':
      return `devient gagnant·e malgré la hausse (+${EUR.format(eur)} €/an)`
  }
}

/** Simulated mylight150 fleet, always labelled as such and kept apart from the room KPIs. */
export function FleetPanel({ fleet }: { fleet: Fleet }) {
  const peak = Math.max(1, ...fleet.activationsTrend)
  const total = fleet.activationsTrend.reduce((a, b) => a + b, 0)

  return (
    <motion.section
      variants={fadeUp}
      className="flex flex-col gap-4 rounded-md border border-dashed border-ink-muted/40 p-4"
      aria-label="Parc mylight150 simulé"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Et si tout le parc mylight150 recevait la page ?</h2>
        <p className="rounded-sm bg-surface px-2 py-1 text-sm font-semibold">{fleet.label}</p>
      </header>

      <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Clients qui ont vu leur hausse', value: fleet.kpis.exposed, suffix: '' },
          { label: 'Activations MSP demandées', value: fleet.kpis.activations, suffix: '' },
          { label: 'Hausse compensée', value: fleet.kpis.compensatedEur, suffix: ' €/an' },
          { label: 'Gagnants malgré le 1/11', value: fleet.kpis.winnersRate, suffix: ' %' },
        ].map((k) => (
          <div key={k.label} className="relative rounded-md bg-surface p-4">
            <KpiFlash value={k.value} />
            <dt className="relative text-sm text-ink-muted">{k.label}</dt>
            <dd className="relative text-3xl font-semibold tabular-nums">
              <AnimatedNumber value={k.value} suffix={k.suffix} />
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 md:grid-cols-2">
        <figure className="flex flex-col gap-2">
          <figcaption className="text-sm text-ink-muted">
            Activations MSP simulées, par tranche de 5 s (2 dernières minutes) · pic : {peak} par
            tranche
          </figcaption>
          <div
            className="flex h-24 items-end gap-1"
            role="img"
            aria-label={`${total} activations MSP simulées sur les 2 dernières minutes, au plus ${peak} par tranche de 5 secondes`}
          >
            {fleet.activationsTrend.map((count, i) => (
              <motion.div
                key={i}
                className={`flex-1 rounded-t-sm ${count === 0 ? 'bg-line' : 'bg-primary'}`}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, (count / peak) * 100)}%` }}
                transition={softSpring}
              />
            ))}
          </div>
        </figure>

        <ul className="relative flex flex-col gap-1 text-base" aria-live="off">
          <AnimatePresence initial={false} mode="popLayout">
            {fleet.feed.length === 0 ? (
              <motion.li key="empty" {...feedItem} className="text-ink-muted">
                Le parc simulé démarre dès que cet écran est ouvert.
              </motion.li>
            ) : (
              fleet.feed.slice(0, 6).map((e) => (
                <motion.li key={`${e.at}-${e.prenom}-${e.type}`} {...feedItem}>
                  <span className="font-semibold">
                    {e.prenom} · {e.ville}
                  </span>{' '}
                  {describe(e)}
                </motion.li>
              ))
            )}
          </AnimatePresence>
        </ul>
      </div>
    </motion.section>
  )
}
