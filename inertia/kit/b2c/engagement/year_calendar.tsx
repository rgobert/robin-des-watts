import { motion, useInView, useReducedMotion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import { cx } from '../../utils'

export type CalendarDay = {
  /** ISO yyyy-mm-dd */
  date: string
  value: number
  /** Jour marqué (ex. aucun kWh acheté au réseau). */
  marked: boolean
}

const TONES = {
  solar: 'var(--color-solar)',
  reward: 'var(--color-reward)',
} as const

const monthLabel = (ym: string) =>
  new Date(`${ym}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'short' })
const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

/**
 * Calendrier de l'année, un mois par ligne, un carré par jour : l'intensité dit la valeur du jour
 * (production ou économie), les jours marqués (sans réseau) s'allument en couleur pleine. Toucher un jour l'explique.
 * Friction traitée : « 166 jours » est un total abstrait ; voir la série d'avril à septembre s'allumer
 * rend la fierté concrète (effet « streak » sans pression : l'année est terminée, rien à perdre).
 * Changer de `tone` repeint le calendrier en vague, de gauche à droite.
 */
export function YearCalendar({
  days,
  tone,
  format,
  markedLabel,
  defaultDate,
  className,
}: {
  days: CalendarDay[]
  tone: keyof typeof TONES
  /** Phrase de détail d'un jour, ex. « 46,6 kWh produits ». */
  format: (value: number) => string
  /** Légende des jours marqués, ex. « jour sans réseau ». */
  markedLabel: string
  defaultDate?: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const reduce = useReducedMotion() ?? false
  const [picked, setPicked] = useState<string>()
  const selected = picked ?? defaultDate ?? days[0]?.date

  const { months, max, index } = useMemo(() => {
    const byMonth = new Map<string, CalendarDay[]>()
    const idx = new Map<string, number>()
    days.forEach((d, i) => {
      const ym = d.date.slice(0, 7)
      byMonth.set(ym, [...(byMonth.get(ym) ?? []), d])
      idx.set(d.date, i)
    })
    return {
      months: [...byMonth.entries()],
      max: Math.max(...days.map((d) => d.value), 1),
      index: idx,
    }
  }, [days])

  const color = TONES[tone]
  const current = days.find((d) => d.date === selected)

  return (
    <div className={cx('flex flex-col gap-3', className)}>
      <div
        ref={ref}
        role="img"
        aria-label={`Calendrier de l’année : ${days.filter((d) => d.marked).length} jours marqués « ${markedLabel} ».`}
        className="flex flex-col gap-[3px]"
        onPointerLeave={() => setPicked(undefined)}
      >
        {months.map(([ym, list]) => (
          <div key={ym} className="flex items-center gap-1.5">
            <span className="w-8 shrink-0 text-[0.6875rem] leading-none text-ink-muted">
              {monthLabel(ym)}
            </span>
            <div className="grid flex-1 grid-cols-[repeat(31,minmax(0,1fr))] gap-[2px]">
              {list.map((d) => {
                const dom = Number(d.date.slice(8, 10))
                const i = index.get(d.date) ?? 0
                const pct = d.marked ? 100 : Math.round(8 + (d.value / max) * 52)
                return (
                  <motion.span
                    key={d.date}
                    style={{
                      gridColumnStart: dom,
                      backgroundColor: `color-mix(in oklab, ${color} ${pct}%, var(--color-gauge-track))`,
                      transitionDelay: reduce ? '0ms' : `${dom * 9}ms`,
                    }}
                    initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                    animate={inView ? { opacity: 1, scale: 1 } : undefined}
                    transition={{ duration: 0.25, delay: reduce ? 0 : i * 0.003 }}
                    onPointerEnter={() => setPicked(d.date)}
                    onClick={() => setPicked(d.date)}
                    className={cx(
                      'aspect-square cursor-pointer rounded-[2px] transition-[background-color] duration-420 ease-[var(--ease-out)]',
                      d.date === selected && 'outline-2 outline-offset-1 outline-primary'
                    )}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-[2px] transition-[background-color] duration-420"
            style={{ backgroundColor: color }}
          />
          {markedLabel}
        </span>
        <span className="flex items-center gap-1">
          moins
          {[10, 25, 40, 60].map((p) => (
            <span
              key={p}
              aria-hidden
              className="size-2.5 rounded-[2px] transition-[background-color] duration-420"
              style={{
                backgroundColor: `color-mix(in oklab, ${color} ${p}%, var(--color-gauge-track))`,
              }}
            />
          ))}
          plus
        </span>
      </div>

      {current && (
        <p className="min-h-10 rounded-md bg-canvas px-3 py-2 text-sm" aria-live="polite">
          <span className="font-semibold">{dayLabel(current.date)}</span> · {format(current.value)}
          {current.marked && <span className="text-win"> · {markedLabel}</span>}
        </p>
      )}
    </div>
  )
}
