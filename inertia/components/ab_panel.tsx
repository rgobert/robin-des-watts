import { AnimatedNumber } from '~/kit'
import { KpiFlash } from '~/components/fleet_panel'

/** Distinct visitors of one variant. */
export type AbRow = {
  exposed: number
  year2: number
  activations: number
  shares: number
  sharedOpens: number
  finishedStory: number
}

/** Mirrors dashboard().abTest from app/services/demo_live_service.ts. */
export type AbTest = {
  n: { euros: number; impact: number }
  euros: AbRow
  impact: AbRow
}

/** Below this many visitors per variant, show counts only: a rate would mean nothing. */
const MIN_SAMPLE = 10
/** Gap under which neither variant is highlighted. */
const MIN_GAP_POINTS = 5

const LINES: { key: keyof AbRow; label: string; rate: boolean }[] = [
  { key: 'exposed', label: 'Exposés', rate: false },
  { key: 'year2', label: 'Année 2 ouverte', rate: true },
  { key: 'activations', label: 'Activation demandée', rate: true },
  { key: 'shares', label: 'Partages', rate: true },
  { key: 'sharedOpens', label: 'Ouvertures de lien partagé', rate: false },
  { key: 'finishedStory', label: 'Slides vues jusqu’au bout', rate: true },
]

const percent = (count: number, exposed: number) =>
  exposed ? Math.round((count / exposed) * 100) : 0

/** Live A/B test of the retro story: real room events only, never the simulated fleet. */
export function AbPanel({ abTest }: { abTest: AbTest }) {
  const enough = abTest.n.euros >= MIN_SAMPLE && abTest.n.impact >= MIN_SAMPLE
  const total = abTest.n.euros + abTest.n.impact

  const cell = (row: AbRow, key: keyof AbRow, rate: boolean) =>
    rate && enough ? percent(row[key], row.exposed) : row[key]

  return (
    <section
      className="flex flex-col gap-3 rounded-md bg-surface p-4"
      aria-label="Test A/B de la rétro"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">Test A/B · rétro (salle, en direct)</h2>
        <p className="text-sm text-ink-muted">Une variante par visiteur, tirée à 50/50</p>
      </header>

      <table className="w-full text-left text-sm tabular-nums">
        <thead>
          <tr className="text-ink-muted">
            <th scope="col" className="py-1 font-normal">
              <span className="sr-only">Indicateur</span>
            </th>
            <th scope="col" className="py-1 text-right font-semibold text-ink">
              Euros
            </th>
            <th scope="col" className="py-1 text-right font-semibold text-ink">
              Impact
            </th>
          </tr>
        </thead>
        <tbody>
          {LINES.map(({ key, label, rate }) => {
            const euros = cell(abTest.euros, key, rate)
            const impact = cell(abTest.impact, key, rate)
            const compare = rate && enough && Math.abs(euros - impact) >= MIN_GAP_POINTS
            const suffix = rate && enough ? ' %' : ''
            return (
              <tr key={key} className="border-t border-canvas">
                <th scope="row" className="py-2 font-normal">
                  {label}
                </th>
                {[euros, impact].map((value, i) => {
                  const best = compare && value === Math.max(euros, impact)
                  return (
                    <td
                      key={i}
                      className={`relative py-2 text-right text-lg ${best ? 'font-semibold text-win' : ''}`}
                    >
                      <KpiFlash value={value} />
                      <AnimatedNumber value={value} suffix={suffix} />
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="text-xs text-ink-muted">
        {enough
          ? `Échantillon de la salle (n = ${total}). Tendance, pas un résultat significatif.`
          : `En attente de la salle… (n = ${total}, taux affichés à partir de ${MIN_SAMPLE} visiteurs par variante)`}
      </p>
    </section>
  )
}
