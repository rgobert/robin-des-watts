import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect } from 'react'
import { duration } from '../motion'
import { cx } from '../utils'

type Props = {
  /** €/an sans réglage : la hausse brute du 1/11 (négative). En `%`, point de départ du remplissage (0 par défaut). */
  baseline?: number
  /** Valeur courante, signée (€/an) ou part en % pour le BO. */
  value: number
  /** Bout droit de l’échelle. Défaut : max(|baseline|, |value|) arrondi au palier supérieur (€), 100 (%). */
  max?: number
  /** Lecture seule (/admin) : pas de libellé « vous », on affiche `label` + la valeur. */
  readOnly?: boolean
  /** Titre visible au-dessus de la jauge, et nom accessible du meter. */
  label?: string
  unit?: '€' | '%'
  className?: string
}

/** Overshoot 4 % de la DA (miroir de --ease-settle), réservé à cette jauge. */
const settle = [0.34, 1.3, 0.64, 1] as const
const nbsp = ' '
const minus = '−'
const fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Arrondi au palier « rond » supérieur : 182 → 200, 38 → 40, 7 → 8. */
function niceCeil(n: number) {
  if (n <= 0) return 1
  const step = 10 ** Math.floor(Math.log10(n)) / 2
  return Math.ceil(n / step) * step
}

const signed = (n: number, unit: string) =>
  `${n < 0 ? minus : ''}${fmt.format(Math.abs(n))}${nbsp}${unit}`

function stateOf(value: number) {
  if (Math.abs(value) < 1) return { kind: 'even' as const, text: 'Hausse compensée' }
  const amount = `${fmt.format(Math.abs(value))}${nbsp}€`
  return value < 0
    ? { kind: 'lose' as const, text: `Perdante de ${amount}` }
    : { kind: 'win' as const, text: `Gagnante de ${amount}` }
}

/**
 * Jauge « gagnante malgré le 1/11 » : le remplissage part de la hausse brute (sans réglage)
 * et va jusqu’à la valeur courante ; rouge hausse sous zéro, vert gain au-dessus.
 * Friction traitée : un chiffre seul ne dit pas d’où l’on part ; la jauge montre le chemin
 * parcouru depuis la hausse et le franchissement du repère « hausse compensée ».
 * L’état est toujours écrit en texte (pas seulement en couleur). Animé uniquement quand
 * `value` change (700 ms, overshoot léger), instantané en mouvement réduit.
 */
export function WinGauge({
  baseline,
  value,
  max,
  readOnly = false,
  label,
  unit = '€',
  className,
}: Props) {
  const reduce = useReducedMotion()
  const percent = unit === '%'
  const base = baseline ?? 0
  const top = max ?? (percent ? 100 : niceCeil(Math.max(Math.abs(base), Math.abs(value))))
  const min = percent ? 0 : -top
  const toFrac = (n: number) => clamp01((n - min) / (top - min))
  const zero = toFrac(0)

  // Positions en fraction de piste [0, 1] : seules ces valeurs bougent, la piste ne relayoute jamais.
  const valueF = useMotionValue(toFrac(value))
  const baseF = useMotionValue(toFrac(base))
  const zeroF = useMotionValue(zero)
  const valueTarget = toFrac(value)
  const baseTarget = toFrac(base)

  useEffect(() => {
    if (reduce) {
      valueF.jump(valueTarget)
      return
    }
    const controls = animate(valueF, valueTarget, { duration: duration.story, ease: settle })
    return () => controls.stop()
  }, [valueTarget, reduce, valueF])

  // La base et l’échelle ne changent qu’avec les données : pas d’animation, pas de saut parasite.
  useEffect(() => {
    baseF.jump(baseTarget)
    zeroF.jump(zero)
  }, [baseTarget, zero, baseF, zeroF])

  const lo = () => clamp01(Math.min(baseF.get(), valueF.get()))
  const hi = () => clamp01(Math.max(baseF.get(), valueF.get()))
  const winStart = () => Math.max(lo(), zeroF.get())
  // translateX(%) puis scaleX depuis la gauche : le segment couvre [début, fin] en transform seul.
  const hikeX = useTransform(() => `${lo() * 100}%`)
  const hikeScale = useTransform(() => Math.max(0, Math.min(hi(), zeroF.get()) - lo()))
  const winX = useTransform(() => `${winStart() * 100}%`)
  const winScale = useTransform(() => Math.max(0, hi() - winStart()))

  const state = stateOf(value)
  const personal = !readOnly && !percent
  const valueText = personal
    ? state.text
    : `${label ? `${label} : ` : ''}${percent ? `${fmt.format(value)}${nbsp}%` : signed(value, '€')}`

  return (
    <div className={cx('w-full', className)}>
      {(label || !personal) && (
        <div className="mb-1 flex items-baseline justify-between gap-3">
          {label && <p className="text-sm text-ink-muted">{label}</p>}
          {!personal && (
            <p className="text-sm font-semibold text-ink tabular-nums">
              {percent ? `${fmt.format(value)}${nbsp}%` : signed(value, '€')}
            </p>
          )}
        </div>
      )}
      {personal && (
        <p
          className={cx(
            'mb-2 text-base font-semibold tabular-nums',
            state.kind === 'lose' && 'text-hike',
            state.kind === 'win' && 'text-win',
            state.kind === 'even' && 'text-ink'
          )}
        >
          {state.text}
        </p>
      )}

      <div
        role="meter"
        aria-label={label ?? 'Gagnante malgré le 1/11'}
        aria-valuemin={min}
        aria-valuemax={top}
        aria-valuenow={Math.round(value)}
        aria-valuetext={valueText}
        className="relative h-5"
      >
        <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full bg-gauge-track">
          {!percent && (
            <motion.div
              aria-hidden
              className="absolute inset-0 origin-left bg-hike"
              style={{ x: hikeX, scaleX: hikeScale }}
            />
          )}
          <motion.div
            aria-hidden
            className="absolute inset-0 origin-left bg-win"
            style={{ x: winX, scaleX: winScale }}
          />
        </div>
        {!percent && (
          <span
            aria-hidden
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-gauge-marker"
            style={{ left: `${zero * 100}%` }}
          />
        )}
        <span
          aria-hidden
          className="absolute inset-y-0 right-0 w-0.5 rounded-full bg-gauge-marker"
        />
      </div>

      <div aria-hidden className="relative mt-1.5 h-4 text-xs text-ink-muted tabular-nums">
        <span className="absolute left-0">{signed(min, unit)}</span>
        {!percent && (
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${zero * 100}%` }}
          >
            hausse compensée
          </span>
        )}
        <span className={cx('absolute right-0', !percent && 'font-medium text-win')}>
          {percent ? signed(top, unit) : 'gagnante'}
        </span>
      </div>
    </div>
  )
}
