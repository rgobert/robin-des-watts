import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { AnimatedNumber } from '../../components/animated_number'
import { WhyThis } from '../../components/explain'
import { duration, ease } from '../../motion'
import { cx } from '../../utils'
import { Segmented, fmtEur, fmtNum, shade } from './shared'

export type KwhSource = {
  id: 'solar' | 'virtual' | 'grid'
  label: string
  kwh: number
  /** Prix payé par kWh, toutes taxes comprises (€). */
  price: number
  /** Ce qui compose ce prix. */
  note: string
}

export const DEFAULT_KWH_SOURCES: KwhSource[] = [
  {
    id: 'solar',
    label: 'Solaire direct',
    kwh: 160,
    price: 0,
    note: 'Produit et consommé sur place : ni achat, ni taxe.',
  },
  {
    id: 'virtual',
    label: 'Batterie virtuelle',
    kwh: 110,
    price: 0.109,
    note: 'Votre surplus restitué : seuls l’acheminement (TURPE), l’accise et les CEE sont dus.',
  },
  { id: 'grid', label: 'Réseau', kwh: 60, price: 0.194, note: 'Acheté au réseau, tarif Base TTC.' },
]

/** Couleur par sens (kit) ; le réseau est assombri vers l'encre pour se distinguer de la batterie (validé ΔE > 19). */
const COLOR: Record<KwhSource['id'], string> = {
  solar: 'var(--color-solar)',
  virtual: 'var(--color-battery)',
  grid: shade('grid', 35),
}

type Mode = 'kwh' | 'eur'
type Labels = { lead: string; month: string; vsGrid: string; modeKwh: string; modeEur: string }
const DEFAULT_LABELS: Labels = {
  lead: 'Votre kWh vous a coûté en moyenne',
  month: 'ce mois-ci',
  vsGrid: 'si tout venait du réseau',
  modeKwh: 'Part des kWh',
  modeEur: 'Part de la facture',
}

/**
 * Coût réel moyen du kWh d'un producteur solaire, décomposé par source : une phrase-chiffre unique
 * (« 0,07 € ce mois-ci ») et une barre empilée solaire / batterie virtuelle / réseau, en kWh ou en €.
 * Survol ou focus d'un segment : kWh, part, prix unitaire, coût. Hypothèses dépliables.
 * Friction traitée : le producteur ne sait pas ce que lui coûte vraiment son électricité ; les taxes
 * sur les kWh restitués restent invisibles et la valeur de Robin aussi (white space n°4).
 * Pattern : P14 (OpenEnergyMonitor pour Octopus Agile).
 */
export function KwhCostBreakdown({
  sources = DEFAULT_KWH_SOURCES,
  monthLabel = 'octobre 2026',
  labels: labelsProp,
  className,
}: {
  sources?: KwhSource[]
  monthLabel?: string
  labels?: Partial<Labels>
  className?: string
}) {
  const L = { ...DEFAULT_LABELS, ...labelsProp }
  const reduce = useReducedMotion()
  const [mode, setMode] = useState<Mode>('kwh')
  const [hover, setHover] = useState<KwhSource['id'] | null>(null)

  const totalKwh = sources.reduce((a, s) => a + s.kwh, 0)
  const totalEur = sources.reduce((a, s) => a + s.kwh * s.price, 0)
  const avg = totalKwh ? totalEur / totalKwh : 0
  const gridPrice = sources.find((s) => s.id === 'grid')?.price ?? 0.194
  const saving = gridPrice ? 1 - avg / gridPrice : 0
  const share = (s: KwhSource) =>
    mode === 'kwh' ? (totalKwh ? s.kwh / totalKwh : 0) : totalEur ? (s.kwh * s.price) / totalEur : 0
  const visible = sources.filter((s) => share(s) > 0)
  const hovered = sources.find((s) => s.id === hover)

  return (
    <div className={cx('rounded-lg border border-line bg-surface p-5 shadow-card', className)}>
      <p className="text-sm text-ink-muted">{L.lead}</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="font-display text-5xl font-semibold tracking-[-0.02em] text-ink">
          <AnimatedNumber value={avg} decimals={2} suffix=" €" />
        </span>
        <span className="text-sm text-ink-muted">
          {L.month} · {monthLabel}
        </span>
      </p>
      <p className="mt-2 text-sm text-ink">
        Contre <strong className="tabular-nums">{fmtEur(gridPrice, 3)}</strong> {L.vsGrid} :{' '}
        <strong className="tabular-nums">−{fmtNum(saving * 100)} %</strong>.
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-muted">
          {mode === 'kwh'
            ? `${fmtNum(totalKwh)} kWh consommés`
            : `${fmtEur(totalEur)} payés pour l’énergie`}
        </p>
        <Segmented
          label="Unité de la barre"
          value={mode}
          onChange={setMode}
          options={[
            { id: 'kwh', label: L.modeKwh },
            { id: 'eur', label: L.modeEur },
          ]}
        />
      </div>

      {/* Barre empilée : 2px d'espace surface entre segments, extrémités arrondies 4px. */}
      <div className="relative mt-3">
        <div
          className="flex h-9 gap-[2px] overflow-visible"
          role="group"
          aria-label={
            mode === 'kwh' ? 'Répartition des kWh par source' : 'Répartition du coût par source'
          }
        >
          {visible.map((s, i) => {
            const p = share(s)
            return (
              <motion.button
                key={s.id}
                type="button"
                layout={!reduce}
                initial={false}
                animate={{ flexGrow: p, opacity: hover && hover !== s.id ? 0.55 : 1 }}
                transition={{ duration: reduce ? 0 : duration.slow, ease: ease.out }}
                onPointerEnter={() => setHover(s.id)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(s.id)}
                onBlur={() => setHover(null)}
                aria-label={`${s.label} : ${fmtNum(p * 100)} %, ${fmtNum(s.kwh)} kWh à ${fmtEur(s.price, 3)} le kWh, ${fmtEur(s.kwh * s.price)}`}
                className={cx(
                  'relative min-w-[6px] basis-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
                  i === 0 && 'rounded-l-[4px]',
                  i === visible.length - 1 && 'rounded-r-[4px]'
                )}
                style={{ background: COLOR[s.id] }}
              >
                {p >= 0.18 && (
                  <span
                    className={cx(
                      'pointer-events-none text-xs font-semibold tabular-nums',
                      s.id === 'grid' ? 'text-canvas' : 'text-ink'
                    )}
                  >
                    {fmtNum(p * 100)} %
                  </span>
                )}
              </motion.button>
            )
          })}
        </div>
        <AnimatePresence>
          {hovered && (
            <motion.div
              key={hovered.id}
              role="tooltip"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: duration.fast, ease: ease.out }}
              className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-60 -translate-x-1/2 rounded-sm bg-ink px-3 py-2 text-xs leading-snug text-canvas shadow-card"
            >
              <p className="flex items-center gap-2">
                <span
                  className="h-0.5 w-3 rounded-full"
                  style={{ background: COLOR[hovered.id] }}
                  aria-hidden
                />
                <strong className="text-sm tabular-nums">{fmtEur(hovered.price, 3)} / kWh</strong>
                <span className="opacity-80">{hovered.label}</span>
              </p>
              <p className="mt-1 tabular-nums opacity-90">
                {fmtNum(hovered.kwh)} kWh · {fmtNum((hovered.kwh / totalKwh) * 100)} % des kWh ·{' '}
                {fmtEur(hovered.kwh * hovered.price)}
              </p>
              <p className="mt-1 opacity-80">{hovered.note}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Légende = vue tableau : chaque valeur est lisible sans survol. */}
      <table className="mt-4 w-full text-sm">
        <caption className="sr-only">Détail par source, {monthLabel}</caption>
        <thead>
          <tr className="text-left text-[11px] text-ink-muted">
            <th className="pb-1 font-normal">Source</th>
            <th className="pb-1 text-right font-normal">kWh</th>
            <th className="pb-1 text-right font-normal">Prix / kWh</th>
            <th className="pb-1 text-right font-normal">Coût</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sources.map((s) => (
            <tr
              key={s.id}
              className={cx('transition-colors', hover === s.id && 'bg-surface-2')}
              onPointerEnter={() => setHover(s.id)}
              onPointerLeave={() => setHover(null)}
            >
              <td className="py-1.5">
                <span className="inline-flex items-center gap-2 text-ink">
                  <span
                    className="size-2.5 shrink-0 rounded-[3px]"
                    style={{ background: COLOR[s.id] }}
                    aria-hidden
                  />
                  {s.label}
                </span>
              </td>
              <td className="py-1.5 text-right text-ink-muted tabular-nums">{fmtNum(s.kwh)}</td>
              <td className="py-1.5 text-right font-medium text-ink tabular-nums">
                {fmtEur(s.price, 3)}
              </td>
              <td className="py-1.5 text-right text-ink-muted tabular-nums">
                {fmtEur(s.kwh * s.price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <WhyThis
        className="mt-4"
        hypotheses={[
          {
            label: 'Moyenne',
            value: `${fmtEur(totalEur)} ÷ ${fmtNum(totalKwh)} kWh = ${fmtEur(avg, 3)}`,
          },
          ...sources.map((s) => ({ label: s.label, value: `${fmtEur(s.price, 3)} / kWh` })),
          { label: 'Hors abonnement', value: 'oui (part fixe)' },
        ]}
        source="Prix TTC d’octobre 2026. Batterie virtuelle : TURPE + accise + CEE sur les kWh restitués. Mesures Robin au pas de 30 min."
      />
    </div>
  )
}
