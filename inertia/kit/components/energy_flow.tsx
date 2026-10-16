import { motion } from 'motion/react'
import { AnimatedNumber } from './animated_number'
import { cx } from '../utils'

/** Flux instantanés en kW. 0 = flux masqué. */
export type Flows = {
  solarToHome?: number
  solarToBattery?: number
  solarToGrid?: number
  batteryToHome?: number
  gridToHome?: number
}

type Props = {
  flows: Flows
  /** Production solaire instantanée affichée sous le soleil (kW). */
  production: number
  /** Consommation de la maison (kW). */
  consumption: number
  /** Remplissage de la batterie (0-100). */
  batteryPct?: number
  labels?: Partial<Record<'solar' | 'home' | 'battery' | 'grid', string>>
  /**
   * virtual (défaut) = batterie virtuelle mylight150, dessinée en nuage avec son stock ;
   * physical = batterie installée chez le client, dessinée en pile.
   * Évite la confusion « j'ai une batterie chez moi ? » (VOC).
   */
  batteryKind?: 'virtual' | 'physical'
  className?: string
}

const PATHS: Record<keyof Flows, { d: string; color: string }> = {
  solarToHome: { d: 'M92 72 Q150 82 178 128', color: 'var(--color-solar)' },
  solarToBattery: { d: 'M70 82 L70 172', color: 'var(--color-solar)' },
  solarToGrid: { d: 'M104 44 Q190 6 276 44', color: 'var(--color-solar)' },
  batteryToHome: { d: 'M92 204 Q150 206 174 172', color: 'var(--color-battery)' },
  gridToHome: { d: 'M286 74 Q250 96 214 130', color: 'var(--color-grid)' },
}

/**
 * Flux d'énergie soleil → maison → batterie / réseau, en boucle.
 * L'épaisseur et la vitesse suivent la puissance : on « voit » où va l'énergie.
 * Friction traitée : des kW abstraits deviennent un schéma compris en 2 secondes.
 */
export function EnergyFlow({
  flows,
  production,
  consumption,
  batteryPct = 60,
  labels,
  batteryKind = 'virtual',
  className,
}: Props) {
  const l = {
    solar: 'Production',
    home: 'Maison',
    battery: batteryKind === 'virtual' ? 'Batterie virtuelle' : 'Batterie',
    grid: 'Réseau',
    ...labels,
  }
  return (
    <figure className={cx('w-full', className)}>
      <svg viewBox="0 0 370 250" className="w-full" role="img" aria-label={describe(flows, l)}>
        {(Object.keys(PATHS) as Array<keyof Flows>).map((key) => {
          const kw = flows[key] ?? 0
          const { d, color } = PATHS[key]
          return (
            <g key={key}>
              <path
                d={d}
                fill="none"
                stroke="var(--color-line)"
                strokeWidth={2}
                strokeLinecap="round"
              />
              <motion.path
                d={d}
                fill="none"
                stroke={color}
                strokeLinecap="round"
                className="kit-flow"
                style={{ ['--flow-speed' as string]: `${Math.max(0.5, 2.2 - kw * 0.35)}s` }}
                initial={false}
                animate={{
                  strokeWidth: kw > 0 ? Math.min(2 + kw * 1.3, 9) : 0,
                  opacity: kw > 0 ? 1 : 0,
                }}
                transition={{ duration: 0.5 }}
              />
            </g>
          )
        })}

        {/* Soleil */}
        <g transform="translate(70 52)" data-kit-loop>
          <g style={{ animation: 'kit-rays 18s linear infinite', transformOrigin: 'center' }}>
            {Array.from({ length: 8 }, (_, i) => (
              <line
                key={i}
                x1="0"
                y1="-30"
                x2="0"
                y2="-24"
                stroke="var(--color-sun)"
                strokeWidth="3"
                strokeLinecap="round"
                transform={`rotate(${i * 45})`}
              />
            ))}
          </g>
          <circle r="18" fill="var(--color-sun)" />
        </g>

        {/* Réseau */}
        <g
          transform="translate(300 52)"
          stroke="var(--color-grid)"
          strokeWidth="2.5"
          fill="none"
          strokeLinejoin="round"
        >
          <path d="M-12 22 L0 -22 L12 22 M-8 6 H8 M-16 -10 H16 M-5 -10 L-9 6 M5 -10 L9 6" />
        </g>

        {/* Maison */}
        <g transform="translate(194 150)">
          <path d="M-30 4 L0 -22 L30 4 V32 H-30 Z" fill="var(--color-home)" />
          <rect
            x="-7"
            y="12"
            width="14"
            height="20"
            rx="2"
            fill="var(--color-surface)"
            opacity="0.9"
          />
        </g>

        {/* Batterie : nuage (virtuelle) ou pile (physique) */}
        {batteryKind === 'virtual' ? (
          <g transform="translate(70 200)">
            <path
              d="M-26 14 H22 A12 12 0 0 0 20 -9 A16 16 0 0 0 -10 -14 A13 13 0 0 0 -26 -2 A8 8 0 0 0 -26 14 Z"
              fill="color-mix(in oklab, var(--color-battery) 18%, var(--color-surface))"
              stroke="var(--color-battery)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <text
              y="6"
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="var(--color-ink)"
              fontFamily="var(--font-body)"
            >
              {Math.round(batteryPct)} %
            </text>
          </g>
        ) : (
          <g transform="translate(70 205)">
            <rect
              x="-16"
              y="-24"
              width="32"
              height="48"
              rx="6"
              fill="none"
              stroke="var(--color-battery)"
              strokeWidth="2.5"
            />
            <rect x="-6" y="-29" width="12" height="5" rx="2" fill="var(--color-battery)" />
            <motion.rect
              x="-11"
              width="22"
              rx="3"
              fill="var(--color-battery)"
              initial={false}
              animate={{ height: (38 * batteryPct) / 100, y: 19 - (38 * batteryPct) / 100 }}
              transition={{ duration: 0.8 }}
            />
          </g>
        )}

        <Label x={70} y={20} text={l.solar} />
        <Label x={300} y={20} text={l.grid} />
        <Label x={194} y={202} text={l.home} />
        <Label x={70} y={246} text={l.battery} />
      </svg>

      <figcaption className="mt-3 flex justify-between text-sm text-ink-muted">
        <span>
          <span className="mr-1 inline-block size-2 rounded-full bg-solar" />
          Production{' '}
          <AnimatedNumber
            className="font-medium text-ink"
            value={production}
            decimals={1}
            suffix=" kW"
          />
        </span>
        <span>
          Consommation{' '}
          <AnimatedNumber
            className="font-medium text-ink"
            value={consumption}
            decimals={1}
            suffix=" kW"
          />
        </span>
      </figcaption>
    </figure>
  )
}

function Label({
  x,
  y,
  text,
  anchor = 'middle',
}: {
  x: number
  y: number
  text: string
  anchor?: 'middle' | 'start'
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize="11"
      fill="var(--color-ink-muted)"
      fontFamily="var(--font-body)"
    >
      {text}
    </text>
  )
}

const kwFr = (v: number) =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v)} kW`

function describe(f: Flows, l: Record<string, string>) {
  const parts: string[] = []
  if (f.solarToHome) parts.push(`${kwFr(f.solarToHome)} de ${l.solar} vers ${l.home}`)
  if (f.solarToBattery) parts.push(`${kwFr(f.solarToBattery)} vers ${l.battery}`)
  if (f.solarToGrid) parts.push(`${kwFr(f.solarToGrid)} injectés sur le ${l.grid}`)
  if (f.batteryToHome) parts.push(`${kwFr(f.batteryToHome)} de la ${l.battery} vers ${l.home}`)
  if (f.gridToHome) parts.push(`${kwFr(f.gridToHome)} achetés au ${l.grid}`)
  return `Flux d'énergie : ${parts.join(', ') || 'aucun flux'}`
}
