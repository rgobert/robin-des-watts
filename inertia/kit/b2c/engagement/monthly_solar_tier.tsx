import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { AnimatedNumber } from '../../components/animated_number'
import { GoalRing } from '../../components/goal_ring'
import { duration, ease } from '../../motion'
import { cx } from '../../utils'
import { fmtEur, tint } from './shared'

export type SolarTier = {
  id: string
  label: string
  /** % de conso en heures solaires pour l'atteindre. */ min: number
  /** Bonus de cagnotte en fin de mois (€). */ bonus: number
}

export const DEFAULT_SOLAR_TIERS: SolarTier[] = [
  { id: 'bronze', label: 'Bronze', min: 40, bonus: 2 },
  { id: 'argent', label: 'Argent', min: 55, bonus: 5 },
  { id: 'or', label: 'Or', min: 70, bonus: 10 },
]

type Labels = { title: string; hint: string; tips: string; reached: string }
const DEFAULT_LABELS: Labels = {
  title: 'de votre conso en heures solaires',
  hint: 'Heures solaires : quand vos panneaux produisent plus que la maison consomme (en octobre, environ 10h-16h).',
  tips: 'Comment monter de palier ?',
  reached: 'Palier atteint',
}

/** Intensité de la teinte « cagnotte » par rang de palier : le rang se lit aussi par le nombre de crans. */
const tierShade = (i: number, n: number) => tint('reward', 35 + (65 * i) / Math.max(1, n - 1))

/**
 * Indicateur unique et mensuel : « X % de votre conso en heures solaires », 3 paliers (bronze, argent,
 * or) liés à un vrai bonus de cagnotte, et la distance au palier suivant (gradient d'objectif).
 * Friction traitée : dix indicateurs dispersent l'attention et aucun ne motive ; un objectif unique,
 * lisible et rémunéré donne une raison de décaler ses usages tout le mois. Progression personnelle,
 * pas de classement.
 * Pattern : P13 (OVO Power Move, paliers fixes ; on garde les paliers, pas le tirage au sort).
 */
export function MonthlySolarTier({
  value = 63,
  monthLabel = 'octobre',
  daysLeft = 17,
  lastMonth = 58,
  tiers = DEFAULT_SOLAR_TIERS,
  tips = [
    { label: 'Lave-linge lancé entre 11h et 15h', gain: '≈ +1 %' },
    { label: 'Lave-vaisselle en départ différé à 12h', gain: '≈ +1 %' },
    { label: 'Garder le mode Smart actif tout le mois', gain: '≈ +6 %' },
  ],
  labels: labelsProp,
  className,
}: {
  /** % de la conso du mois réalisée en heures solaires (0-100). */
  value?: number
  monthLabel?: string
  daysLeft?: number
  /** Valeur du mois précédent, pour se comparer à soi-même. */
  lastMonth?: number
  tiers?: SolarTier[]
  tips?: { label: string; gain: string }[]
  labels?: Partial<Labels>
  className?: string
}) {
  const L = { ...DEFAULT_LABELS, ...labelsProp }
  const reduce = useReducedMotion()
  const [openTips, setOpenTips] = useState(false)
  const sorted = [...tiers].sort((a, b) => a.min - b.min)
  const reachedIdx = sorted.reduce((acc, t, i) => (value >= t.min ? i : acc), -1)
  const current = reachedIdx >= 0 ? sorted[reachedIdx] : null
  const next = sorted[reachedIdx + 1]
  const prevMin = current?.min ?? 0
  const toNext = next ? next.min - value : 0
  const localPct = next ? ((value - prevMin) / (next.min - prevMin)) * 100 : 100
  const delta = value - lastMonth

  return (
    <div className={cx('rounded-lg border border-line bg-surface p-5 shadow-card', className)}>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <GoalRing
          value={localPct}
          size={128}
          stroke={10}
          color="var(--color-reward)"
          celebrate={!next}
        >
          <div>
            <p className="font-display text-3xl font-semibold text-ink">
              <AnimatedNumber value={value} suffix=" %" />
            </p>
            <p className="text-[11px] text-ink-muted">en {monthLabel}</p>
          </div>
        </GoalRing>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-sm text-ink-muted">
            <strong className="font-semibold text-ink">{value} %</strong> {L.title}
          </p>
          {current ? (
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-ink">
              <TierMark index={reachedIdx} total={sorted.length} /> Palier{' '}
              <strong>{current.label}</strong> · +{fmtEur(current.bonus, 0)} assurés
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink">Pas encore de palier ce mois-ci.</p>
          )}
          <p className="mt-2 font-display text-lg leading-snug font-semibold text-ink">
            {next ? (
              <>
                Plus que {toNext} % pour {next.label} : +{fmtEur(next.bonus, 0)} de cagnotte
              </>
            ) : (
              <>
                Palier maximal atteint, bravo : +{fmtEur(current?.bonus ?? 0, 0)} fin {monthLabel}
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Encore {daysLeft} jours · {delta >= 0 ? `+${delta}` : `−${Math.abs(delta)}`} % par
            rapport au mois dernier
          </p>
        </div>
      </div>

      {/* Piste 0-100 % avec les paliers : la valeur avance vers le prochain cran. */}
      <div className="mt-6">
        <div className="relative h-2.5 rounded-full bg-surface-2">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-reward"
            initial={{ width: 0 }}
            whileInView={{ width: `${value}%` }}
            animate={{ width: `${value}%` }}
            viewport={{ once: true }}
            transition={{ duration: reduce ? 0 : duration.story, ease: ease.out }}
          />
          {sorted.map((t) => (
            <span
              key={t.id}
              className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-ink/60"
              style={{ left: `${t.min}%` }}
              aria-hidden
            />
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-3 gap-2 text-xs" aria-label="Paliers du mois">
          {sorted.map((t, i) => {
            const reached = value >= t.min
            return (
              <li
                key={t.id}
                className={cx(
                  'rounded-md border px-2.5 py-2',
                  reached ? 'border-ink/25 bg-surface-2' : 'border-line'
                )}
              >
                <span
                  className={cx(
                    'flex items-center gap-1.5 font-semibold',
                    reached ? 'text-ink' : 'text-ink-muted'
                  )}
                >
                  <TierMark index={i} total={sorted.length} dim={!reached} />
                  {t.label}
                </span>
                <span className="mt-0.5 block text-ink-muted tabular-nums">
                  dès {t.min} % · +{t.bonus} €
                </span>
                <span className="sr-only">{reached ? L.reached : 'à atteindre'}</span>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="mt-2 border-t border-line pt-3">
        <button
          type="button"
          aria-expanded={openTips}
          onClick={() => setOpenTips((o) => !o)}
          className="text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-primary"
        >
          {L.tips}
        </button>
        {openTips && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration.fast, ease: ease.out }}
          >
            <ul className="mt-2 divide-y divide-line rounded-sm border border-line text-sm">
              {tips.map((t) => (
                <li key={t.label} className="flex justify-between gap-3 px-3 py-2">
                  <span className="text-ink">{t.label}</span>
                  <span className="shrink-0 font-medium text-ink-muted tabular-nums">{t.gain}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-muted">{L.hint}</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}

/** Cran de palier : n petits losanges (1 bronze, 2 argent, 3 or) dans la teinte cagnotte, plus foncée avec le rang. */
function TierMark({ index, total, dim }: { index: number; total: number; dim?: boolean }) {
  return (
    <span className={cx('inline-flex gap-0.5', dim && 'opacity-50')} aria-hidden>
      {Array.from({ length: index + 1 }, (_, k) => (
        <span
          key={k}
          className="size-2 rotate-45 rounded-[2px]"
          style={{ background: tierShade(index, total) }}
        />
      ))}
    </span>
  )
}
