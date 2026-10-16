import { AnimatePresence, motion } from 'motion/react'
import { useId, useState, type ReactNode } from 'react'
import { duration, ease } from '../motion'
import { cx } from '../utils'

/**
 * Terme du glossaire avec définition au survol / focus / tap.
 * Friction traitée : le jargon (batterie virtuelle, kWc, autoconsommation) bloque la compréhension.
 * Usage : <Term def="Le surplus de vos panneaux, gardé en kWh pour plus tard.">batterie virtuelle</Term>
 */
export function Term({ def, children }: { def: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span className="relative inline">
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.stopPropagation()
            setOpen(false)
          }
        }}
        className="cursor-help underline decoration-ink-muted/60 decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary"
      >
        {children}
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: duration.fast, ease: ease.out }}
            className="absolute bottom-full left-1/2 z-30 mb-2 block w-56 -translate-x-1/2 rounded-sm bg-ink px-3 py-2 text-xs leading-snug font-normal text-canvas shadow-card"
          >
            {def}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

type Hypothesis = { label: string; value: string }

/**
 * « Pourquoi ce chiffre ? » : dépliable qui expose les hypothèses d'un calcul.
 * Friction traitée : un chiffre sans explication n'inspire pas confiance (surtout une promesse d'économies).
 */
export function WhyThis({
  title = 'Pourquoi ce chiffre ?',
  hypotheses,
  source,
  className,
}: {
  title?: string
  hypotheses: Hypothesis[]
  source?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className={cx('text-sm', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 font-medium text-primary focus-visible:outline-2 focus-visible:outline-primary"
      >
        {title}
        <motion.svg
          viewBox="0 0 12 12"
          className="size-3"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: duration.fast }}
        >
          <path
            d="M2 4.5l4 3.5 4-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </motion.svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: duration.base, ease: ease.out }}
            className="overflow-hidden"
          >
            <dl className="mt-3 divide-y divide-line rounded-sm border border-line bg-surface">
              {hypotheses.map((h) => (
                <div key={h.label} className="flex justify-between gap-4 px-3 py-2">
                  <dt className="text-ink-muted">{h.label}</dt>
                  <dd className="text-right font-medium tabular-nums text-ink">{h.value}</dd>
                </div>
              ))}
            </dl>
            {source && <p className="mt-2 text-xs text-ink-muted">{source}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
