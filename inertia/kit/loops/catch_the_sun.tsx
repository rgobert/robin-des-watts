import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { spring } from '../motion'
import { cx } from '../utils'

type Ray = { id: number; x: number; born: number; speed: number }

type Props = {
  /** Durée de la partie en secondes (10 conseillé : calée sur une attente longue). */
  seconds?: number
  /** kWh crédités par rayon attrapé (pour le storytelling final). */
  kwhPerRay?: number
  /** Phrase de fin à partir du total, ex. (kwh) => `= ${Math.round(kwh * 6)} douches chaudes`. */
  translate?: (kwh: number) => string
  /** Si fourni, le jeu s'arrête dès que le vrai résultat est prêt. */
  stopWhen?: boolean
  onEnd?: (kwh: number) => void
  /** true pendant une vraie attente (démarre seul) ; false = écran « Jouer » d'abord. */
  autoStart?: boolean
  className?: string
}

/**
 * Mini-jeu d'attente « Attrapez le soleil » : on clique les rayons avant qu'ils ne tombent.
 * Pour une attente de 5 à 15 s (calcul, appel LLM, simulation). Optionnel, jamais bloquant :
 * le résultat s'affiche dès qu'il est prêt.
 *
 * E-GAMIF : les kWh du jeu sont des kWh « pour jouer », affichés comme tels (« kWh captés · pour jouer »).
 * Ils ne sont ni la production réelle du foyer ni de la cagnotte : ne jamais les additionner à de vraies données.
 * À utiliser uniquement pendant une vraie attente, avec `stopWhen` branché sur le résultat
 * (ex. `stopWhen={!!result}`) : le jeu s'arrête dès que la réponse est prête, il ne la retarde jamais.
 */
export function CatchTheSun({
  seconds = 10,
  kwhPerRay = 0.4,
  translate,
  stopWhen,
  onEnd,
  autoStart = true,
  className,
}: Props) {
  const [started, setStarted] = useState(autoStart)
  const [rays, setRays] = useState<Ray[]>([])
  const [caught, setCaught] = useState(0)
  const [left, setLeft] = useState(seconds)
  // Score final en kWh, figé à la fin de la partie (null tant qu'elle dure).
  const [result, setResult] = useState<number | null>(null)
  const over = result !== null
  const id = useRef(0)
  const onEndRef = useRef(onEnd)
  useLayoutEffect(() => {
    onEndRef.current = onEnd
  })

  useEffect(() => {
    if (over || !started) return
    const spawn = setInterval(() => {
      setRays((rs) => [
        ...rs.slice(-7),
        {
          id: id.current++,
          x: 8 + Math.random() * 84,
          born: Date.now(),
          speed: 2.2 + Math.random() * 1.4,
        },
      ])
    }, 520)
    const tick = setInterval(() => setLeft((l) => l - 1), 1000)
    return () => {
      clearInterval(spawn)
      clearInterval(tick)
    }
  }, [over, started])

  if (started && !over && (left <= 0 || stopWhen)) {
    setResult(caught * kwhPerRay)
    setRays([])
  }
  useEffect(() => {
    if (result !== null) onEndRef.current?.(result)
  }, [result])

  const catchRay = (rid: number) => {
    setCaught((c) => c + 1)
    setRays((rs) => rs.filter((r) => r.id !== rid))
  }

  const kwh = caught * kwhPerRay

  return (
    <div
      className={cx(
        'relative h-64 w-full overflow-hidden rounded-lg border border-line bg-surface-2 select-none',
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-3 text-sm">
        <span className="font-medium text-ink">
          <span className="tabular-nums">
            {kwh.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
          </span>{' '}
          kWh captés <span className="font-normal text-ink-muted">· pour jouer</span>
        </span>
        {!over && <span className="tabular-nums text-ink-muted">{Math.max(left, 0)} s</span>}
      </div>

      <AnimatePresence>
        {rays.map((r) => (
          <motion.button
            key={r.id}
            aria-label="Attraper ce rayon"
            className="absolute top-0 grid size-11 -translate-x-1/2 place-items-center"
            style={{ left: `${r.x}%` }}
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 260, opacity: 1 }}
            exit={{ scale: 1.8, opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: r.speed, ease: 'linear' }}
            onAnimationComplete={() => setRays((rs) => rs.filter((x) => x.id !== r.id))}
            onPointerDown={() => catchRay(r.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                catchRay(r.id)
              }
            }}
          >
            <svg viewBox="0 0 24 24" className="size-8">
              <circle cx="12" cy="12" r="6" fill="var(--color-sun)" />
              {Array.from({ length: 8 }, (_, i) => (
                <line
                  key={i}
                  x1="12"
                  y1="1.5"
                  x2="12"
                  y2="4"
                  stroke="var(--color-sun)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  transform={`rotate(${i * 45} 12 12)`}
                />
              ))}
            </svg>
          </motion.button>
        ))}
      </AnimatePresence>

      {!started && (
        <div className="absolute inset-0 z-20 grid place-items-center text-center">
          <div>
            <p className="font-display text-xl text-ink">Attrapez le soleil</p>
            <p className="mt-1 text-sm text-ink-muted">
              {seconds} secondes pour remplir la batterie du jeu
            </p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setStarted(true)}
              className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-contrast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Jouer
            </motion.button>
          </div>
        </div>
      )}

      {started && !over && caught === 0 && left > seconds - 3 && (
        <p className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-sm text-ink-muted">
          Touchez les rayons pour remplir la batterie du jeu
        </p>
      )}

      <AnimatePresence>
        {over && (
          <motion.div
            className="absolute inset-0 grid place-items-center bg-surface/90 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              transition={spring}
            >
              <p className="font-display text-3xl font-semibold text-ink tabular-nums">
                {kwh.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kWh
              </p>
              <p className="text-xs font-medium text-ink-muted">kWh pour jouer</p>
              {translate && <p className="mt-1 text-sm text-ink-muted">{translate(kwh)}</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
