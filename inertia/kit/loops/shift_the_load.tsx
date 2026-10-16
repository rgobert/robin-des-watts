import { animate, motion, useMotionValue } from 'motion/react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatedNumber } from '../components/animated_number'
import { spring } from '../motion'
import { cx } from '../utils'

/** Intensité solaire relative par heure, de 6h à 21h (16 créneaux). Remplaçable par la vraie courbe du foyer. */
export const DEFAULT_SOLAR_PROFILE = [
  0, 0.05, 0.15, 0.3, 0.5, 0.7, 0.85, 0.95, 1, 0.95, 0.85, 0.7, 0.5, 0.3, 0.15, 0.05,
]
const FIRST_HOUR = 6

export type Appliance = { name: string; hours: number; kw: number; start: number }

const DEFAULT_APPLIANCES: Appliance[] = [
  { name: 'Lave-linge', hours: 2, kw: 1, start: 13 },
  { name: 'Chauffe-eau', hours: 3, kw: 2, start: 12 },
]

type Props = {
  appliances?: Appliance[]
  profile?: number[]
  /** € par kWh solaire consommé au lieu d'être acheté. */
  pricePerKwh?: number
  onValidate?: (solarShare: number) => void
  className?: string
}

const coverage = (profile: number[], start: number, hours: number) =>
  profile.slice(start, start + hours).reduce((a, b) => a + b, 0) / hours

/**
 * Mini-jeu « Décalez vos appareils » : glisser chaque appareil sur le créneau le plus solaire.
 * Pédagogie du pilotage : on comprend en 15 s ce que Robin fait tous les jours. Clavier : flèches gauche / droite.
 */
export function ShiftTheLoad({
  appliances = DEFAULT_APPLIANCES,
  profile = DEFAULT_SOLAR_PROFILE,
  pricePerKwh = 0.194,
  onValidate,
  className,
}: Props) {
  const [starts, setStarts] = useState(() => appliances.map((a) => a.start))
  const [done, setDone] = useState(false)

  const kwhTotal = appliances.reduce((s, a) => s + a.hours * a.kw, 0)
  const solarKwh = appliances.reduce(
    (s, a, k) => s + a.hours * a.kw * coverage(profile, starts[k], a.hours),
    0
  )
  const share = solarKwh / kwhTotal
  const best = useMemo(
    () =>
      appliances.reduce((s, a) => {
        let m = 0
        for (let st = 0; st <= profile.length - a.hours; st++)
          m = Math.max(m, coverage(profile, st, a.hours))
        return s + a.hours * a.kw * m
      }, 0) / kwhTotal,
    [appliances, profile, kwhTotal]
  )

  return (
    <div className={cx('rounded-lg border border-line bg-surface p-4 sm:p-5', className)}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm text-ink-muted">Glissez vos appareils sous le soleil</p>
        <p className="text-sm font-medium text-ink">
          <AnimatedNumber value={Math.round(share * 100)} suffix=" %" duration={0.35} /> solaire
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <SolarStrip profile={profile} />
        {appliances.map((a, k) => (
          <Track
            key={a.name}
            appliance={a}
            slots={profile.length}
            start={starts[k]}
            share={coverage(profile, starts[k], a.hours)}
            disabled={done}
            onChange={(v) => setStarts((s) => s.map((x, j) => (j === k ? v : x)))}
          />
        ))}
        <div className="flex justify-between px-0.5 text-[11px] text-ink-muted tabular-nums">
          {[6, 9, 12, 15, 18, 21].map((h) => (
            <span key={h}>{h}h</span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {done ? (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-ink"
          >
            {share >= best - 0.01
              ? 'Parfait, comme Robin.'
              : `Robin aurait atteint ${Math.round(best * 100)} %.`}{' '}
            <span className="text-ink-muted">
              Soit{' '}
              <span className="font-medium text-ink tabular-nums">
                {(solarKwh * pricePerKwh).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €
              </span>{' '}
              d’électricité gratuite ce jour-là.
            </span>
          </motion.p>
        ) : (
          <span />
        )}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            if (done) {
              setStarts(appliances.map((a) => a.start))
              setDone(false)
            } else {
              setDone(true)
              onValidate?.(share)
            }
          }}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-contrast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {done ? 'Rejouer' : 'Valider'}
        </motion.button>
      </div>
    </div>
  )
}

function SolarStrip({ profile }: { profile: number[] }) {
  return (
    <div className="flex h-8 items-end gap-0.5" aria-hidden>
      {profile.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm bg-solar"
          style={{ height: `${Math.max(v * 100, 4)}%`, opacity: 0.25 + v * 0.75 }}
        />
      ))}
    </div>
  )
}

function Track({
  appliance,
  slots,
  start,
  share,
  disabled,
  onChange,
}: {
  appliance: Appliance
  slots: number
  start: number
  share: number
  disabled: boolean
  onChange: (start: number) => void
}) {
  const track = useRef<HTMLDivElement>(null)
  const [slotW, setSlotW] = useState(0)
  const x = useMotionValue(0)
  const max = slots - appliance.hours

  useLayoutEffect(() => {
    const el = track.current
    if (!el) return
    const ro = new ResizeObserver(() => setSlotW(el.clientWidth / slots))
    ro.observe(el)
    return () => ro.disconnect()
  }, [slots])

  useLayoutEffect(() => {
    if (slotW) animate(x, start * slotW, spring)
  }, [start, slotW, x])

  const snap = () => {
    const v = Math.max(0, Math.min(max, Math.round(x.get() / slotW)))
    onChange(v)
    animate(x, v * slotW, spring)
  }

  const from = FIRST_HOUR + start
  return (
    <div>
      <p className="mb-1 flex justify-between text-xs">
        <span className="font-medium text-ink">{appliance.name}</span>
        <span className="tabular-nums text-ink-muted">
          {from}h → {from + appliance.hours}h
        </span>
      </p>
      <div ref={track} className="relative h-10 rounded-sm bg-surface-2">
        <motion.button
          drag={disabled ? false : 'x'}
          dragConstraints={{ left: 0, right: max * slotW }}
          dragElastic={0}
          dragMomentum={false}
          onDrag={() => {
            const v = Math.max(0, Math.min(max, Math.round(x.get() / slotW)))
            if (v !== start) onChange(v)
          }}
          onDragEnd={snap}
          onKeyDown={(e) => {
            if (disabled) return
            if (e.key === 'ArrowLeft') onChange(Math.max(0, start - 1))
            if (e.key === 'ArrowRight') onChange(Math.min(max, start + 1))
          }}
          whileDrag={{ scale: 1.03, zIndex: 10 }}
          style={{ x, width: slotW * appliance.hours || undefined }}
          aria-label={`${appliance.name}, de ${from}h à ${from + appliance.hours}h. Flèches pour déplacer.`}
          className={cx(
            'absolute inset-y-1 left-0 flex cursor-grab items-center rounded-sm px-1 text-xs font-semibold shadow-card active:cursor-grabbing',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            share > 0.75
              ? 'bg-primary text-primary-contrast'
              : 'bg-surface text-ink border border-line'
          )}
        >
          <span className="mx-auto tabular-nums">{Math.round(share * 100)} %</span>
        </motion.button>
      </div>
    </div>
  )
}
