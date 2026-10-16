import { motion } from 'motion/react'
import { useId, type ReactNode } from 'react'
import { spring } from '../../motion'
import { cx } from '../../utils'

export type LensOption<T extends string> = { id: T; label: string; icon?: ReactNode }

/**
 * Bascule de lecture (ex. « Mes économies » / « Mon impact ») : mêmes données, deux histoires.
 * Friction traitée : un persona « portefeuille » décroche devant des kg de CO₂, un persona « planète »
 * devant des euros ; chacun choisit sa lecture sans quitter l'écran. La pastille glisse (cause → effet).
 * Pattern : radiogroup accessible (flèches gauche/droite), cible tactile ≥ 44 px.
 */
export function LensToggle<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: LensOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
}) {
  const thumb = useId()

  const move = (step: number) => {
    const i = options.findIndex((o) => o.id === value)
    onChange(options[(i + step + options.length) % options.length].id)
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(
        'flex w-full rounded-full bg-surface p-1 shadow-card ring-1 ring-line',
        className
      )}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(1)
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(-1)
      }}
    >
      {options.map((o) => {
        const active = o.id === value
        return (
          <motion.button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.id)}
            whileTap={{ scale: 0.97 }}
            transition={spring}
            className={cx(
              'relative flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              active ? 'text-primary-contrast' : 'text-ink-muted hover:text-ink'
            )}
          >
            {active && (
              <motion.span
                layoutId={thumb}
                aria-hidden
                className="absolute inset-0 rounded-full bg-primary"
                transition={spring}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {o.icon}
              {o.label}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
