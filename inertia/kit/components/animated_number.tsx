import { animate, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { ease } from '../motion'

type Props = {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  /** secondes */
  duration?: number
  className?: string
}

/**
 * Chiffre qui défile jusqu'à sa valeur quand il entre à l'écran, puis à chaque changement.
 * Friction traitée : un chiffre statique ne se remarque pas ; le mouvement relie cause et effet.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 0.9,
  className = '',
}: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduce = useReducedMotion()
  const current = useRef(0)
  const fmt = useMemo(
    () =>
      new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
    [decimals]
  )

  useEffect(() => {
    const node = ref.current
    if (!node || !inView) return
    if (reduce) {
      node.textContent = fmt.format(value)
      current.current = value
      return
    }
    const controls = animate(current.current, value, {
      duration,
      ease: ease.out,
      onUpdate: (v) => {
        current.current = v
        node.textContent = fmt.format(v)
      },
    })
    return () => controls.stop()
  }, [value, inView, reduce, fmt, duration])

  return (
    <span
      role="img"
      className={`tabular-nums ${className}`}
      aria-label={`${prefix}${fmt.format(value)}${suffix}`}
    >
      <span aria-hidden>{prefix}</span>
      <span ref={ref} aria-hidden>
        {fmt.format(0)}
      </span>
      <span aria-hidden>{suffix}</span>
    </span>
  )
}
