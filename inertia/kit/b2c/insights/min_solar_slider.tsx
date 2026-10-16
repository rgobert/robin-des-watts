import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useId, useState } from 'react'
import { AnimatedNumber } from '../../components/animated_number'
import { spring } from '../../motion'
import { cx, formatEuro } from '../../utils'
import { fmtNum } from './shared'

const SLIDER_LABELS = {
  title: 'Part solaire minimale de la recharge',
  help: 'En dessous de ce seuil, Robin met la recharge en pause et attend le soleil.',
  sunny: 'Jour ensoleillé',
  grey: 'Jour gris',
  cost: 'Coût d’une recharge de 30 kWh',
  slowWarning: 'Recharge plus lente les jours gris : la voiture peut ne pas être pleine le matin.',
  fastNote: 'Recharge rapide garantie, quitte à acheter au réseau.',
  boostHint: 'Besoin de partir ? Le bouton « Maintenant quand même » reste disponible.',
}

/**
 * Curseur « part solaire minimale » pour la borne, avec la conséquence affichée en direct :
 * durée de recharge par jour ensoleillé / gris et coût estimé.
 *
 * Friction traitée : un réglage technique sans conséquence visible ; on montre ce qu'on gagne (0 € de réseau) et ce qu'on perd (vitesse les jours gris).
 * Pattern : P5 (myenergi zappi, réglage « Minimum Green Level »)
 */
export function MinSolarSlider({
  value: controlled,
  defaultValue = 60,
  onChange,
  step = 10,
  chargeKwh = 30,
  gridPrice = 0.1952,
  sunnyHours = 4.5,
  labels,
  className,
}: {
  value?: number
  defaultValue?: number
  onChange?: (v: number) => void
  step?: number
  /** Énergie d'une recharge type (kWh). */
  chargeKwh?: number
  gridPrice?: number
  /** Durée d'une recharge 100 % soleil un jour clair (h). */
  sunnyHours?: number
  labels?: Partial<typeof SLIDER_LABELS>
  className?: string
}) {
  const l = { ...SLIDER_LABELS, ...labels }
  const id = useId()
  const reduce = useReducedMotion()
  const [inner, setInner] = useState(defaultValue)
  const v = controlled ?? inner
  const set = (n: number) => {
    setInner(n)
    onChange?.(n)
  }
  // Modèle simple, assumé et lisible : borne 7 kW au réseau ; par jour gris le surplus tombe à ~1,6 kW.
  const fastHours = chargeKwh / 7
  const sunny = Math.max(fastHours, sunnyHours * (v / 100) + fastHours * (1 - v / 100))
  const greyKw = 1.6
  const grey =
    v === 0 ? fastHours : (chargeKwh * (v / 100)) / greyKw + (chargeKwh * (1 - v / 100)) / 7
  const cost = chargeKwh * (1 - v / 100) * gridPrice
  const slow = v >= 50
  const fmtH = (h: number) => (h >= 10 ? `${fmtNum(Math.round(h))} h` : `${fmtNum(h, 1)} h`)

  return (
    <div className={cx('flex flex-col gap-4', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {l.title}
        </label>
        <span className="font-display text-2xl font-semibold">
          <AnimatedNumber value={v} suffix=" %" duration={0.3} />
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={step}
        value={v}
        onChange={(e) => set(Number(e.target.value))}
        aria-valuetext={`${v} % solaire minimum. ${slow ? l.slowWarning : l.fastNote}`}
        className="h-2 w-full cursor-pointer accent-solar"
      />
      <div className="-mt-2 flex justify-between text-xs text-ink-muted" aria-hidden>
        <span>0 % · le plus rapide</span>
        <span>100 % · que du soleil</span>
      </div>
      <p className="text-sm text-ink-muted">{l.help}</p>

      <dl className="grid grid-cols-3 gap-2">
        {[
          { k: l.sunny, v: fmtH(sunny) },
          { k: l.grey, v: fmtH(grey), warn: slow },
          { k: l.cost, v: formatEuro(cost, 2) },
        ].map((c) => (
          <div
            key={c.k}
            className={cx(
              'min-w-0 rounded-sm border bg-surface px-3 py-2',
              c.warn ? 'border-warning/50' : 'border-line'
            )}
          >
            <dt className="text-xs leading-tight text-ink-muted">{c.k}</dt>
            <dd className="mt-1 text-base font-semibold tabular-nums">{c.v}</dd>
          </div>
        ))}
      </dl>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={slow ? 'slow' : 'fast'}
          initial={{ opacity: 0, y: reduce ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={reduce ? { duration: 0 } : spring}
          className={cx(
            'flex items-start gap-2 rounded-sm px-3 py-2 text-sm',
            slow ? 'bg-warning/10 text-ink' : 'bg-surface-2 text-ink'
          )}
          aria-live="polite"
        >
          <span
            aria-hidden
            className={cx('mt-1 size-2 shrink-0 rounded-full', slow ? 'bg-warning' : 'bg-success')}
          />
          <span>
            <span className="font-semibold">{slow ? 'À savoir : ' : 'Info : '}</span>
            {slow ? l.slowWarning : l.fastNote}{' '}
            <span className="text-ink-muted">{l.boostHint}</span>
          </span>
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
