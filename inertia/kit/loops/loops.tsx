/*
 * Banque de boucles d'attente en SVG + CSS pur (0 dépendance, ~1 ko chacune, nettes à toutes les tailles).
 * Toutes respectent prefers-reduced-motion via [data-kit-loop] (voir tokens.css).
 * Couleurs = tokens énergie, donc elles prennent le DS automatiquement.
 */
import { cx } from '../utils'

type LoopProps = { size?: number; className?: string; label?: string }

/** Soleil qui rayonne : attente courte, « on calcule votre production ». */
export function SunLoop({ size = 96, className, label = 'Calcul en cours' }: LoopProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={label}
      data-kit-loop
    >
      <circle
        cx="50"
        cy="50"
        r="30"
        fill="var(--color-sun)"
        style={{
          animation: 'kit-halo 2.4s var(--ease-in-out) infinite',
          transformOrigin: '50px 50px',
        }}
      />
      <g style={{ animation: 'kit-rays 10s linear infinite', transformOrigin: '50px 50px' }}>
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={i}
            x1="50"
            y1="12"
            x2="50"
            y2={i % 2 ? 20 : 23}
            stroke="var(--color-sun)"
            strokeWidth="3.5"
            strokeLinecap="round"
            transform={`rotate(${i * 30} 50 50)`}
          />
        ))}
      </g>
      <circle cx="50" cy="50" r="18" fill="var(--color-sun)" />
    </svg>
  )
}

/** Batterie qui se remplit par vagues : « on remplit votre batterie virtuelle », activation, transfert. */
export function BatteryChargeLoop({ size = 96, className, label = 'Chargement' }: LoopProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={label}
      data-kit-loop
    >
      <style>{`
        @keyframes kit-fill { 0% { transform: translateY(52px) } 85%, 100% { transform: translateY(0) } }
        @keyframes kit-wave { to { transform: translateX(-40px) } }
        @keyframes kit-bolt { 0%, 70%, 100% { opacity: .35 } 80% { opacity: 1 } }
      `}</style>
      <defs>
        <clipPath id="kit-batt-clip">
          <rect x="32" y="24" width="36" height="58" rx="7" />
        </clipPath>
      </defs>
      <rect
        x="28"
        y="20"
        width="44"
        height="66"
        rx="10"
        fill="none"
        stroke="var(--color-battery)"
        strokeWidth="4"
      />
      <rect x="42" y="12" width="16" height="7" rx="3" fill="var(--color-battery)" />
      <g clipPath="url(#kit-batt-clip)">
        <g style={{ animation: 'kit-fill 3.2s var(--ease-in-out) infinite' }}>
          <g style={{ animation: 'kit-wave 1.2s linear infinite' }}>
            <path
              d="M20 30 q10 -6 20 0 t20 0 t20 0 t20 0 t20 0 V100 H20 Z"
              fill="var(--color-battery)"
              opacity="0.85"
            />
          </g>
        </g>
      </g>
      <path
        d="M53 38 L43 55 H50 L46 70 L58 51 H51 Z"
        fill="var(--color-surface)"
        style={{ animation: 'kit-bolt 3.2s infinite' }}
      />
    </svg>
  )
}

/**
 * Journée solaire en boucle : le soleil traverse le ciel au-dessus de la maison, le ciel passe du jour à la nuit.
 * Pour une attente plus longue (3-8 s) ou un écran « on rejoue votre journée ».
 */
export function DayCycleLoop({
  size = 220,
  className,
  label = 'Votre journée solaire',
}: LoopProps) {
  return (
    <svg
      viewBox="0 0 220 130"
      width={size}
      height={(size * 130) / 220}
      className={cx('overflow-visible', className)}
      role="img"
      aria-label={label}
      data-kit-loop
    >
      <style>{`
        @keyframes kit-sky { 0%, 100% { opacity: 0 } 15%, 70% { opacity: 1 } 85% { opacity: 0 } }
        @keyframes kit-arc { from { offset-distance: 0% } to { offset-distance: 100% } }
        @keyframes kit-win { 0%, 70% { opacity: .15 } 80%, 95% { opacity: 1 } 100% { opacity: .15 } }
        @keyframes kit-stars { 0%, 70% { opacity: 0 } 85%, 95% { opacity: 1 } 100% { opacity: 0 } }
      `}</style>
      <defs>
        <clipPath id="kit-day-clip">
          <rect x="0" y="0" width="220" height="130" rx="16" />
        </clipPath>
      </defs>
      <g clipPath="url(#kit-day-clip)">
        <rect x="0" y="0" width="220" height="130" fill="var(--color-primary)" />
        <rect
          x="0"
          y="0"
          width="220"
          height="130"
          fill="var(--color-sky)"
          style={{ animation: 'kit-sky 6s linear infinite' }}
        />
        <g style={{ animation: 'kit-stars 6s linear infinite' }} fill="var(--color-canvas)">
          <circle cx="40" cy="26" r="1.4" />
          <circle cx="160" cy="18" r="1.2" />
          <circle cx="185" cy="44" r="1.4" />
          <circle cx="70" cy="50" r="1" />
        </g>
        <circle
          r="11"
          fill="var(--color-sun)"
          style={{
            offsetPath: "path('M10 100 Q110 -30 210 100')",
            animation: 'kit-arc 6s var(--ease-in-out) infinite',
          }}
        />
        <rect x="0" y="104" width="220" height="26" fill="var(--color-home)" opacity="0.18" />
        <g transform="translate(110 104)">
          <path d="M-26 0 V-26 L0 -46 L26 -26 V0 Z" fill="var(--color-home)" />
          <path d="M-6 -46 L20 -26 L26 -26 L0 -46 Z" fill="var(--color-sun)" opacity="0.6" />
          <rect
            x="-15"
            y="-22"
            width="10"
            height="10"
            rx="2"
            fill="var(--color-sun)"
            style={{ animation: 'kit-win 6s linear infinite' }}
          />
          <rect
            x="5"
            y="-22"
            width="10"
            height="10"
            rx="2"
            fill="var(--color-sun)"
            style={{ animation: 'kit-win 6s linear infinite' }}
          />
        </g>
      </g>
    </svg>
  )
}
