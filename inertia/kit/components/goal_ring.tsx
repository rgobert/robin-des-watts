import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ease } from '../motion'
import { cx } from '../utils'

type Props = {
  /** 0-100 */
  value: number
  size?: number
  stroke?: number
  color?: string
  children?: ReactNode
  /** Micro-célébration sobre, une seule fois, quand l'objectif est atteint. */
  celebrate?: boolean
  className?: string
}

/**
 * Jauge circulaire qui se remplit (objectif de cagnotte, autonomie, part solaire).
 * Friction traitée : la progression vers un objectif motive plus qu'un total brut.
 */
export function GoalRing({
  value,
  size = 160,
  stroke = 12,
  color = 'var(--color-reward)',
  children,
  celebrate = true,
  className,
}: Props) {
  const ref = useRef<SVGSVGElement>(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()
  const r = (size - stroke) / 2
  const pct = Math.max(0, Math.min(100, value))
  const [burst, setBurst] = useState(false)
  const celebrated = useRef(false)

  useEffect(() => {
    if (!celebrate || reduce || !inView || pct < 100 || celebrated.current) return
    celebrated.current = true
    const t1 = setTimeout(() => setBurst(true), 1000)
    const t2 = setTimeout(() => setBurst(false), 2000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [pct, inView, celebrate, reduce])

  return (
    <div
      className={cx('relative inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg ref={ref} width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: inView ? pct / 100 : 0 }}
          transition={{ duration: reduce ? 0 : 1.1, ease: ease.out }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
      <AnimatePresence>
        {burst &&
          Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2
            return (
              <motion.span
                key={i}
                className="absolute size-1.5 rounded-full"
                style={{ background: i % 2 ? color : 'var(--color-primary)' }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(a) * (size / 2 + 14),
                  y: Math.sin(a) * (size / 2 + 14),
                  opacity: 0,
                  scale: 0.4,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: ease.out }}
              />
            )
          })}
      </AnimatePresence>
    </div>
  )
}
