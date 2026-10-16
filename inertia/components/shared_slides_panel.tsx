import { motion } from 'motion/react'
import { AnimatedNumber } from '~/kit'
import { ease, softSpring } from '~/kit/motion'
import { KpiFlash } from '~/components/fleet_panel'

/** Mirrors dashboard().sharesBySlide from app/services/demo_live_service.ts. */
export type SharesBySlide = {
  sharers: number
  slides: { slide: string; shares: number; opens: number; topVue: 'euros' | 'impact' | null }[]
}

/** BO labels of the retro slides. */
export const SLIDE_LABELS: Record<string, string> = {
  intro: 'Anniversaire',
  hausse: 'Hausse du 1/11',
  valeur_nette: 'Valeur nette',
  meilleur_jour: 'Meilleur jour',
  co2: 'CO₂ évité',
  autoconsommation: 'Autoconsommation',
  record: 'Record',
  jours_sans_reseau: 'Série solaire',
  trophees: 'Trophées',
  cta: 'Année 2',
}

/** Which retro slide the room wants to show: real shares only, sorted server-side. */
export function SharedSlidesPanel({ sharesBySlide }: { sharesBySlide: SharesBySlide }) {
  const { sharers, slides } = sharesBySlide
  const top = Math.max(1, ...slides.map((s) => s.shares))

  return (
    <section
      className="flex flex-col gap-3 rounded-md bg-surface p-4"
      aria-label="Slides partagées"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">Slides partagées · salle, en direct</h2>
        <p className="text-sm text-ink-muted">Partages · ouvertures du lien</p>
      </header>

      {sharers === 0 ? (
        <p className="text-base text-ink-muted">
          Aucune slide partagée pour l’instant. Touchez l’icône de partage en haut de la rétro.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {slides.map((s, i) => {
            const lead = i === 0 && s.shares > 0
            return (
              <motion.li
                key={s.slide}
                layout
                transition={softSpring}
                className={`grid grid-cols-[9rem_1fr_auto] items-center gap-3 text-sm ${s.shares === 0 ? 'text-ink-muted' : ''}`}
              >
                <span className={lead ? 'font-semibold text-win' : ''}>
                  {SLIDE_LABELS[s.slide] ?? s.slide}
                  {s.topVue && (
                    <span className="block text-xs font-normal text-ink-muted">
                      surtout en {s.topVue === 'impact' ? 'Impact' : 'Économies'}
                    </span>
                  )}
                </span>
                <span className="h-3 overflow-hidden rounded-full bg-canvas">
                  <motion.span
                    className={`block h-full origin-left rounded-full ${lead ? 'bg-win' : 'bg-primary'}`}
                    initial={false}
                    animate={{ scaleX: s.shares / top }}
                    transition={{ duration: 0.5, ease: ease.out }}
                  />
                </span>
                <span className="relative text-right tabular-nums">
                  <KpiFlash value={s.shares} />
                  {s.shares === 0 ? (
                    'jamais partagée'
                  ) : (
                    <>
                      <AnimatedNumber value={s.shares} className="text-lg font-semibold" /> ·{' '}
                      <AnimatedNumber value={s.opens} />
                    </>
                  )}
                </span>
              </motion.li>
            )
          })}
        </ol>
      )}

      <p className="text-xs text-ink-muted">
        Partages de la salle (n = {sharers} visiteur{sharers > 1 ? 's' : ''}). Tendance, pas un
        résultat significatif.
      </p>
    </section>
  )
}
