import { AnimatePresence, motion } from 'motion/react'
import { useId, useState } from 'react'
import { AssistantAvatar } from '../../components/assistant_avatar'
import { useToast } from '../../components/toast'
import { duration, ease } from '../../motion'
import { cx } from '../../utils'
import { Segmented, fmtHour, tint } from './shared'

export type ForecastSlot = {
  /** Heure de début / fin (décimale : 11.5 = 11h30). */
  start: number
  end: number
  /** Probabilité de prix négatifs sur le créneau (0-1). */
  negativePrice: number
  /** Probabilité de grand soleil (production > 70 % de la crête) (0-1). */
  sun: number
  /** Ce que Robin fera si le créneau se confirme. */
  robinActions?: string[]
}
export type ForecastDay = {
  id: string
  label: string
  /** Jours d'avance : la fiabilité baisse avec l'horizon. */ horizon: number
  slots: ForecastSlot[]
}

type Metric = 'negativePrice' | 'sun'

type Labels = {
  title: string
  metricNegative: string
  metricSun: string
  thresholdLabel: string
  alertOn: string
  alertOff: string
  indicative: string
  noSlot: string
  legend: string
}
const DEFAULT_LABELS: Labels = {
  title: 'Les 5 prochains jours',
  metricNegative: 'Prix négatifs',
  metricSun: 'Grand soleil',
  thresholdLabel: 'Me prévenir au-dessus de',
  alertOn: 'Alerte activée · dès 6h10 la veille',
  alertOff: 'Activer l’alerte',
  indicative: 'indicatif',
  noSlot:
    'Aucun créneau ne dépasse votre seuil pour l’instant. Robin continue de piloter au mieux, sans alerte.',
  legend: 'Probabilité',
}

const DEFAULT_ACTIONS = ['remplir le ballon', 'charger la voiture']
const s = (
  start: number,
  end: number,
  negativePrice: number,
  sun: number,
  robinActions?: string[]
): ForecastSlot => ({ start, end, negativePrice, sun, robinActions })

/** Mock crédible : jeudi 15 → lundi 19 octobre 2026, anticyclone en milieu de semaine. */
export const DEFAULT_FORECAST: ForecastDay[] = [
  {
    id: 'd1',
    label: 'Jeu. 15',
    horizon: 1,
    slots: [
      s(8, 11, 0.1, 0.45),
      s(11, 15, 0.8, 0.92, ['remplir le ballon', 'charger la voiture']),
      s(15, 18, 0.35, 0.6, ['préchauffer la maison (PAC)']),
      s(18, 21, 0, 0),
    ],
  },
  {
    id: 'd2',
    label: 'Ven. 16',
    horizon: 2,
    slots: [s(8, 11, 0.05, 0.3), s(11, 15, 0.55, 0.78), s(15, 18, 0.2, 0.5), s(18, 21, 0, 0)],
  },
  {
    id: 'd3',
    label: 'Sam. 17',
    horizon: 3,
    slots: [s(8, 11, 0, 0.15), s(11, 15, 0.15, 0.35), s(15, 18, 0.05, 0.2), s(18, 21, 0, 0)],
  },
  {
    id: 'd4',
    label: 'Dim. 18',
    horizon: 4,
    slots: [s(8, 11, 0.1, 0.35), s(11, 15, 0.6, 0.7), s(15, 18, 0.25, 0.45), s(18, 21, 0, 0)],
  },
  {
    id: 'd5',
    label: 'Lun. 19',
    horizon: 5,
    slots: [s(8, 11, 0.2, 0.4), s(11, 15, 0.75, 0.74), s(15, 18, 0.3, 0.5), s(18, 21, 0, 0)],
  },
]

const joinFr = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} et ${xs[xs.length - 1]}`

/**
 * Prévision probabiliste sur 3 à 7 jours : chance de prix négatifs (ou de grand soleil) par créneau,
 * seuil d'alerte choisi par l'utilisateur, phrase de Robin qui dit ce qu'il fera.
 * Friction traitée : une prévision binaire (« soleil demain ») trompe ; l'utilisateur apprend trop tard
 * qu'une bonne fenêtre arrive, et ne sait pas ce que Robin va en faire.
 * Pattern : P9 (Selectra Tempo, Octopus Agile).
 */
// Premier créneau qui atteint le seuil, tous jours confondus.
function findFirstHot(days: ForecastDay[], metric: Metric, threshold: number) {
  for (const d of days)
    for (let i = 0; i < d.slots.length; i++)
      if (d.slots[i][metric] * 100 >= threshold) return { day: d.id, i }
  return null
}

export function ProbabilisticForecast({
  days = DEFAULT_FORECAST,
  threshold: thresholdProp = 70,
  onThresholdChange,
  alertEnabled: alertProp = false,
  onAlertChange,
  defaultMetric = 'negativePrice',
  labels: labelsProp,
  className,
}: {
  days?: ForecastDay[]
  /** Seuil d'alerte initial, en %. */
  threshold?: number
  onThresholdChange?: (v: number) => void
  alertEnabled?: boolean
  onAlertChange?: (on: boolean) => void
  defaultMetric?: Metric
  labels?: Partial<Labels>
  className?: string
}) {
  const L = { ...DEFAULT_LABELS, ...labelsProp }
  const toast = useToast()
  const [metric, setMetric] = useState<Metric>(defaultMetric)
  const [threshold, setThreshold] = useState(thresholdProp)
  const [alert, setAlert] = useState(alertProp)
  const firstHot = findFirstHot(days, metric, threshold)
  const [selected, setSelected] = useState<{ day: string; i: number } | null>(null)
  const sel = selected ?? firstHot ?? { day: days[0]?.id ?? '', i: 1 }
  const selDay = days.find((d) => d.id === sel.day) ?? days[0]
  const selSlot = selDay?.slots[sel.i]
  const sliderId = useId()

  const slotsHeader = days[0]?.slots ?? []
  const metricLabel =
    metric === 'negativePrice' ? L.metricNegative.toLowerCase() : L.metricSun.toLowerCase()
  const token = metric === 'negativePrice' ? 'reward' : 'solar'

  const headline = (() => {
    if (!firstHot) return L.noSlot
    const d = days.find((x) => x.id === firstHot.day)!
    const sl = d.slots[firstHot.i]
    const when = d.horizon === 1 ? 'Demain' : d.label
    const acts = joinFr(sl.robinActions ?? DEFAULT_ACTIONS)
    return `${when} ${fmtHour(sl.start)}-${fmtHour(sl.end)} : ${Math.round(sl[metric] * 100)} % de chances de ${metricLabel}, Robin va ${acts}.`
  })()

  const toggleAlert = () => {
    const next = !alert
    setAlert(next)
    onAlertChange?.(next)
    toast({
      message: next
        ? `Alerte activée : on vous prévient dès ${threshold} % de chances.`
        : 'Alerte désactivée. Robin continue de piloter sans vous déranger.',
      tone: next ? 'success' : 'neutral',
      actionLabel: 'Annuler',
      onAction: () => {
        setAlert(!next)
        onAlertChange?.(!next)
      },
    })
  }

  return (
    <div
      className={cx('rounded-lg border border-line bg-surface p-4 shadow-card sm:p-5', className)}
    >
      <div className="flex items-start gap-3">
        <AssistantAvatar mood={firstHot ? 'happy' : 'idle'} size={40} />
        <p className="text-[15px] leading-snug font-medium text-ink" aria-live="polite">
          {headline}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{L.title}</p>
        <Segmented
          label="Type de prévision"
          value={metric}
          onChange={(m) => {
            setMetric(m)
            setSelected(null)
          }}
          options={[
            { id: 'negativePrice', label: L.metricNegative },
            { id: 'sun', label: L.metricSun },
          ]}
        />
      </div>

      {/* Grille jours × créneaux : échelle séquentielle à une seule teinte, valeur toujours écrite. */}
      <div
        className="mt-3 grid gap-1"
        style={{ gridTemplateColumns: `3.6rem repeat(${slotsHeader.length}, minmax(0, 1fr))` }}
        role="group"
        aria-label={`Probabilité de ${metricLabel} par créneau`}
      >
        <div className="contents">
          <span />
          {slotsHeader.map((sl) => (
            <span
              key={sl.start}
              className="pb-1 text-center text-[11px] text-ink-muted tabular-nums"
            >
              {fmtHour(sl.start)}-{fmtHour(sl.end)}
            </span>
          ))}
        </div>
        {days.map((d) => (
          <div className="contents" key={d.id}>
            <span className="flex flex-col justify-center text-xs font-medium text-ink">
              {d.label}
              {d.horizon >= 4 && (
                <span className="text-[10px] font-normal text-ink-muted">{L.indicative}</span>
              )}
            </span>
            {d.slots.map((sl, i) => {
              const p = Math.round(sl[metric] * 100)
              const hot = p >= threshold
              const isSel = sel.day === d.id && sel.i === i
              // la fiabilité baisse avec l'horizon : la cellule pâlit (l'incertitude se voit)
              const fade = d.horizon >= 4 ? 0.7 : 1
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={isSel}
                  aria-label={`${d.label}, ${fmtHour(sl.start)}-${fmtHour(sl.end)} : ${p} %${hot ? ', au-dessus de votre seuil' : ''}`}
                  onClick={() => setSelected({ day: d.id, i })}
                  className={cx(
                    'relative h-10 rounded-sm text-xs font-semibold tabular-nums text-ink transition-shadow focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
                    isSel && 'ring-2 ring-ink',
                    !isSel && hot && 'ring-1 ring-ink/40'
                  )}
                  style={{ background: tint(token, (8 + p * 0.82) * fade) }}
                >
                  {p} %
                  {hot && (
                    <span
                      aria-hidden
                      className="absolute top-1 right-1 size-1.5 rounded-full bg-ink"
                    />
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-muted">
        <span>{L.legend}</span>
        <span
          className="h-2 w-24 rounded-full"
          style={{ background: `linear-gradient(90deg, ${tint(token, 8)}, ${tint(token, 90)})` }}
          aria-hidden
        />
        <span>0 → 100 %</span>
        <span className="ml-2 inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-ink" aria-hidden /> au-dessus du seuil
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {selDay && selSlot && (
          <motion.div
            key={`${sel.day}-${sel.i}-${metric}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast, ease: ease.out }}
            className="mt-4 rounded-md bg-surface-2 px-3 py-2.5 text-sm text-ink"
          >
            <p className="font-medium">
              {selDay.label} · {fmtHour(selSlot.start)}-{fmtHour(selSlot.end)}
            </p>
            <p className="mt-0.5 text-ink-muted">
              {Math.round(selSlot.negativePrice * 100)} % de chances de prix négatifs ·{' '}
              {Math.round(selSlot.sun * 100)} % de grand soleil.{' '}
              {selSlot.sun < 0.05
                ? 'Pas de soleil sur ce créneau : Robin puise dans votre batterie virtuelle.'
                : `Si ça se confirme, Robin va ${joinFr(selSlot.robinActions ?? DEFAULT_ACTIONS)}.`}
              {selDay.horizon >= 4 &&
                ' Prévision à plus de 3 jours : elle sera affinée chaque matin.'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line pt-4">
        <label htmlFor={sliderId} className="text-sm text-ink">
          {L.thresholdLabel} <strong className="tabular-nums">{threshold} %</strong>
        </label>
        <input
          id={sliderId}
          type="range"
          min={50}
          max={95}
          step={5}
          value={threshold}
          onChange={(e) => {
            const v = Number(e.target.value)
            setThreshold(v)
            setSelected(null)
            onThresholdChange?.(v)
          }}
          className="w-36 accent-primary"
        />
        <button
          type="button"
          aria-pressed={alert}
          onClick={toggleAlert}
          className={cx(
            'ml-auto inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            alert ? 'bg-surface-2 text-ink' : 'bg-primary text-primary-contrast hover:bg-primary/90'
          )}
        >
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
            <path
              d="M8 2.2a4 4 0 0 0-4 4v2.6L2.8 11h10.4L12 8.8V6.2a4 4 0 0 0-4-4zM6.5 12.6a1.6 1.6 0 0 0 3 0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
          {alert ? L.alertOn : L.alertOff}
        </button>
      </div>
    </div>
  )
}
