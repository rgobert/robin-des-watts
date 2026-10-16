import { motion } from 'motion/react'
import { AnimatedNumber } from '../../components/animated_number'
import { Term } from '../../components/explain'
import { cx } from '../../utils'
import { fmtKw, fmtKwh, fmtNum } from './shared'

export type FlowPlusNode = 'solar' | 'home' | 'grid' | 'battery' | 'virtual' | 'ev'

/** Flux instantanés en kW, dans le sens du flux. 0 ou absent = flux masqué. */
export type FlowPlusFlows = Partial<
  Record<
    | 'solarToHome'
    | 'solarToBattery'
    | 'solarToVirtual'
    | 'solarToGrid'
    | 'solarToEv'
    | 'batteryToHome'
    | 'virtualToHome'
    | 'virtualToEv'
    | 'gridToHome'
    | 'gridToEv',
    number
  >
>
type FlowKey = keyof FlowPlusFlows

/** Totaux du jour (kWh) affichés sous le schéma. */
export type FlowPlusTotals = {
  produced: number
  consumed: number
  storedVirtual: number
  restoredVirtual: number
  bought: number
}

/* Géométrie (viewBox 380 × 316). Chaque chemin part de la source et s'arrête au bord de la cible : le pointillé avance dans le sens du flux. */
const POS: Record<FlowPlusNode, { x: number; y: number }> = {
  solar: { x: 62, y: 58 },
  virtual: { x: 318, y: 58 },
  home: { x: 190, y: 150 },
  battery: { x: 62, y: 246 },
  grid: { x: 318, y: 246 },
  ev: { x: 190, y: 262 },
}

const PATHS: Record<FlowKey, { d: string; from: FlowPlusNode; to: FlowPlusNode }> = {
  solarToHome: { d: 'M88 72 Q140 90 160 128', from: 'solar', to: 'home' },
  solarToBattery: { d: 'M62 88 L62 214', from: 'solar', to: 'battery' },
  solarToVirtual: { d: 'M94 48 Q190 18 282 48', from: 'solar', to: 'virtual' },
  solarToGrid: { d: 'M84 84 Q200 150 292 228', from: 'solar', to: 'grid' },
  solarToEv: { d: 'M74 88 Q100 220 158 258', from: 'solar', to: 'ev' },
  batteryToHome: { d: 'M90 236 Q140 214 164 172', from: 'battery', to: 'home' },
  virtualToHome: { d: 'M294 80 Q244 96 220 128', from: 'virtual', to: 'home' },
  virtualToEv: { d: 'M330 86 Q330 200 222 258', from: 'virtual', to: 'ev' },
  gridToHome: { d: 'M292 236 Q240 214 216 172', from: 'grid', to: 'home' },
  gridToEv: { d: 'M290 254 L224 262', from: 'grid', to: 'ev' },
}

const COLOR: Record<FlowPlusNode, string> = {
  solar: 'var(--color-solar)',
  battery: 'var(--color-battery)',
  virtual: 'var(--color-battery)',
  grid: 'var(--color-grid)',
  home: 'var(--color-home)',
  ev: 'var(--color-home)',
}

const DEFAULT_FLOWS: FlowPlusFlows = {
  solarToHome: 0.9,
  solarToEv: 1.4,
  solarToBattery: 0.6,
  solarToVirtual: 1.0,
}
const DEFAULT_TOTALS: FlowPlusTotals = {
  produced: 18.4,
  consumed: 13.6,
  storedVirtual: 5.1,
  restoredVirtual: 2.3,
  bought: 0.6,
}

const DEFAULT_LABELS: Record<FlowPlusNode, string> = {
  solar: 'Panneaux',
  home: 'Maison',
  grid: 'Réseau',
  battery: 'Batterie ENCORE',
  virtual: 'Batterie virtuelle',
  ev: 'Voiture',
}

/**
 * Flux d'énergie en direct, version complète : panneaux, maison, réseau, batterie physique (optionnelle),
 * batterie virtuelle (nuage, distincte de la batterie physique) et borne VE (optionnelle).
 * Le pointillé avance dans le sens du flux, l'épaisseur suit les kW ; puissance instantanée + total du jour.
 *
 * Friction traitée : « où part mon soleil ? » et la confusion batterie physique / batterie virtuelle ; le système se comprend en 2 secondes.
 * Pattern : P3 (mySolarEdge, écran d'accueil avec nœuds batterie et VE)
 */
export function EnergyFlowPlus({
  flows = DEFAULT_FLOWS,
  production,
  consumption,
  hasBattery = true,
  hasEv = true,
  batteryPct = 64,
  virtualStockKwh = 186,
  evPct = 58,
  totals = DEFAULT_TOTALS,
  time = '13h12',
  labels,
  className,
}: {
  flows?: FlowPlusFlows
  /** Production instantanée (kW). Par défaut : somme des flux sortant des panneaux. */
  production?: number
  /** Consommation maison + voiture (kW). Par défaut : somme des flux entrants. */
  consumption?: number
  hasBattery?: boolean
  hasEv?: boolean
  batteryPct?: number
  virtualStockKwh?: number
  evPct?: number
  totals?: FlowPlusTotals
  /** Heure affichée (« en direct · 13h12 »). */
  time?: string
  labels?: Partial<Record<FlowPlusNode, string>>
  className?: string
}) {
  const l = { ...DEFAULT_LABELS, ...labels }
  const visible = (n: FlowPlusNode) => (n === 'battery' ? hasBattery : n === 'ev' ? hasEv : true)
  const active = (Object.keys(PATHS) as FlowKey[]).filter(
    (k) => visible(PATHS[k].from) && visible(PATHS[k].to)
  )
  const sumFrom = (n: FlowPlusNode) =>
    active.filter((k) => PATHS[k].from === n).reduce((s, k) => s + (flows[k] ?? 0), 0)
  const sumTo = (n: FlowPlusNode) =>
    active.filter((k) => PATHS[k].to === n).reduce((s, k) => s + (flows[k] ?? 0), 0)
  const prod = production ?? sumFrom('solar')
  const cons = consumption ?? sumTo('home') + sumTo('ev')

  const nodeKw: Record<FlowPlusNode, string> = {
    solar: fmtKw(prod),
    home: fmtKw(sumTo('home')),
    ev: sumTo('ev') > 0 ? `${fmtKw(sumTo('ev'))} · ${fmtNum(evPct)} %` : `${fmtNum(evPct)} %`,
    grid: netLabel(sumTo('grid') - sumFrom('grid')),
    battery: `${fmtNum(batteryPct)} % · ${batteryLabel(sumTo('battery') - sumFrom('battery'))}`,
    virtual: `${fmtKwh(virtualStockKwh)}`,
  }

  const aria = describe(active, flows, l, prod, cons)

  return (
    <figure className={cx('w-full', className)}>
      <div className="mb-2 flex items-center gap-2 text-xs text-ink-muted">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-50 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
        En direct · {time}
      </div>
      <svg viewBox="0 0 380 316" className="w-full" role="img" aria-label={aria}>
        <defs>
          {(['solar', 'battery', 'grid'] as const).map((c) => (
            <marker
              key={c}
              id={`efp-arrow-${c}`}
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="9"
              markerHeight="9"
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <path
                d="M1 1 L8 5 L1 9"
                fill="none"
                stroke={COLOR[c]}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </marker>
          ))}
        </defs>

        {active.map((key) => {
          const kw = flows[key] ?? 0
          const { d, from } = PATHS[key]
          const colorKey =
            from === 'virtual'
              ? 'battery'
              : from === 'solar'
                ? 'solar'
                : from === 'grid'
                  ? 'grid'
                  : 'battery'
          return (
            <g key={key}>
              <path
                d={d}
                fill="none"
                stroke="var(--color-line)"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
              <motion.path
                d={d}
                fill="none"
                stroke={COLOR[from]}
                strokeLinecap="round"
                className="kit-flow"
                markerEnd={kw > 0 ? `url(#efp-arrow-${colorKey})` : undefined}
                style={{ ['--flow-speed' as string]: `${Math.max(0.5, 2.2 - kw * 0.35)}s` }}
                initial={false}
                animate={{
                  strokeWidth: kw > 0 ? Math.min(2 + kw * 1.4, 9) : 0,
                  opacity: kw > 0 ? 1 : 0,
                }}
                transition={{ duration: 0.5 }}
              />
            </g>
          )
        })}

        {/* Panneaux + soleil */}
        <g transform={`translate(${POS.solar.x} ${POS.solar.y})`} data-kit-loop>
          <g style={{ animation: 'kit-rays 18s linear infinite', transformOrigin: 'center' }}>
            {Array.from({ length: 8 }, (_, i) => (
              <line
                key={i}
                x1="0"
                y1="-26"
                x2="0"
                y2="-21"
                stroke="var(--color-sun)"
                strokeWidth="3"
                strokeLinecap="round"
                transform={`rotate(${i * 45})`}
              />
            ))}
          </g>
          <circle r="15" fill="var(--color-sun)" />
        </g>

        {/* Batterie virtuelle : nuage, pour la distinguer de la batterie physique */}
        <g transform={`translate(${POS.virtual.x} ${POS.virtual.y})`}>
          <path
            d="M-26 14 H22 A12 12 0 0 0 20 -9 A16 16 0 0 0 -10 -14 A13 13 0 0 0 -26 -2 A8 8 0 0 0 -26 14 Z"
            fill="color-mix(in oklab, var(--color-battery) 18%, var(--color-surface))"
            stroke="var(--color-battery)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M-6 6 V-4 M-10 -1 L-6 -5 L-2 -1 M6 -4 V6 M2 3 L6 7 L10 3"
            fill="none"
            stroke="var(--color-battery)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Maison */}
        <g transform={`translate(${POS.home.x} ${POS.home.y})`}>
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

        {/* Réseau */}
        <g
          transform={`translate(${POS.grid.x} ${POS.grid.y})`}
          stroke="var(--color-grid)"
          strokeWidth="2.5"
          fill="none"
          strokeLinejoin="round"
        >
          <path d="M-12 22 L0 -22 L12 22 M-8 6 H8 M-16 -10 H16 M-5 -10 L-9 6 M5 -10 L9 6" />
        </g>

        {/* Batterie physique (optionnelle) */}
        {hasBattery && (
          <g transform={`translate(${POS.battery.x} ${POS.battery.y})`}>
            <rect
              x="-15"
              y="-26"
              width="30"
              height="48"
              rx="6"
              fill="none"
              stroke="var(--color-battery)"
              strokeWidth="2.5"
            />
            <rect x="-6" y="-31" width="12" height="5" rx="2" fill="var(--color-battery)" />
            <motion.rect
              x="-10"
              width="20"
              rx="3"
              fill="var(--color-battery)"
              initial={false}
              animate={{ height: (38 * batteryPct) / 100, y: 17 - (38 * batteryPct) / 100 }}
              transition={{ duration: 0.8 }}
            />
          </g>
        )}

        {/* Voiture (optionnelle) */}
        {hasEv && (
          <g transform={`translate(${POS.ev.x} ${POS.ev.y})`}>
            <path d="M-30 6 V-2 L-22 -6 L-14 -16 H12 L22 -6 L30 -2 V6 Z" fill="var(--color-home)" />
            <circle
              cx="-17"
              cy="8"
              r="5"
              fill="var(--color-surface)"
              stroke="var(--color-home)"
              strokeWidth="2.5"
            />
            <circle
              cx="17"
              cy="8"
              r="5"
              fill="var(--color-surface)"
              stroke="var(--color-home)"
              strokeWidth="2.5"
            />
            <path d="M-10 -12 H8 L14 -6 H-14 Z" fill="var(--color-surface)" opacity="0.85" />
          </g>
        )}

        <NodeLabel
          x={POS.solar.x}
          y={104}
          name={l.solar}
          value={nodeKw.solar}
          anchor="start"
          dx={-40}
        />
        <NodeLabel
          x={POS.virtual.x + 44}
          y={14}
          name={l.virtual}
          value={nodeKw.virtual}
          anchor="end"
        />
        <NodeLabel x={POS.home.x} y={198} name={l.home} value={nodeKw.home} />
        <NodeLabel x={POS.grid.x + 44} y={286} name={l.grid} value={nodeKw.grid} anchor="end" />
        {hasBattery && (
          <NodeLabel
            x={POS.battery.x - 40}
            y={286}
            name={l.battery}
            value={nodeKw.battery}
            anchor="start"
          />
        )}
        {hasEv && <NodeLabel x={POS.ev.x} y={290} name={l.ev} value={nodeKw.ev} />}
      </svg>

      <figcaption className="mt-3 space-y-3">
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-solar" aria-hidden />
            Production{' '}
            <AnimatedNumber
              className="font-medium text-ink"
              value={prod}
              decimals={1}
              suffix=" kW"
            />
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-home" aria-hidden />
            Consommation{' '}
            <AnimatedNumber
              className="font-medium text-ink"
              value={cons}
              decimals={1}
              suffix=" kW"
            />
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { k: "Produit aujourd'hui", v: totals.produced, c: 'bg-solar' },
            { k: 'Consommé', v: totals.consumed, c: 'bg-home' },
            {
              k: 'Mis en stock virtuel',
              v: totals.storedVirtual - totals.restoredVirtual,
              c: 'bg-battery',
              signed: true,
            },
            { k: 'Acheté au réseau', v: totals.bought, c: 'bg-grid' },
          ].map((t) => (
            <div key={t.k} className="rounded-sm border border-line bg-surface px-3 py-2">
              <dt className="flex items-center gap-1.5 text-xs text-ink-muted">
                <span className={cx('size-1.5 rounded-full', t.c)} aria-hidden />
                {t.k}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold">
                <AnimatedNumber
                  value={t.v}
                  decimals={1}
                  prefix={t.signed && t.v > 0 ? '+' : ''}
                  suffix=" kWh"
                />
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-ink-muted">
          Le nuage, c’est votre{' '}
          <Term def="Votre surplus solaire, gardé en kWh chez mylight150 et restitué le soir ou l'hiver. Rien n'est stocké chez vous : ce n'est pas une batterie physique.">
            batterie virtuelle
          </Term>
          {hasBattery && (
            <>
              {' '}
              ; la pile, votre{' '}
              <Term def="Batterie physique installée chez vous : elle restitue l'énergie dans la soirée, sans passer par le réseau.">
                batterie ENCORE
              </Term>
            </>
          )}
          .
        </p>
      </figcaption>
    </figure>
  )
}

function NodeLabel({
  x,
  y,
  name,
  value,
  anchor = 'middle',
  dx = 0,
}: {
  x: number
  y: number
  name: string
  value: string
  anchor?: 'middle' | 'start' | 'end'
  dx?: number
}) {
  const xx = anchor === 'start' && dx ? x + dx : x
  return (
    <text x={xx} y={y} textAnchor={anchor} fontFamily="var(--font-body)">
      <tspan x={xx} fontSize="11" fill="var(--color-ink-muted)">
        {name}
      </tspan>
      <tspan x={xx} dy="14" fontSize="12" fontWeight="600" fill="var(--color-ink)">
        {value}
      </tspan>
    </text>
  )
}

function netLabel(net: number) {
  if (net > 0.05) return `${fmtKw(net)} injectés`
  if (net < -0.05) return `${fmtKw(-net)} achetés`
  return '0 kW acheté'
}
function batteryLabel(net: number) {
  if (net > 0.05) return `+${fmtKw(net)}`
  if (net < -0.05) return `−${fmtKw(-net)}`
  return 'au repos'
}

function describe(
  keys: FlowKey[],
  f: FlowPlusFlows,
  l: Record<FlowPlusNode, string>,
  prod: number,
  cons: number
) {
  const parts = keys
    .filter((k) => (f[k] ?? 0) > 0)
    .map((k) => `${fmtKw(f[k] ?? 0)} de ${l[PATHS[k].from]} vers ${l[PATHS[k].to]}`)
  return `Flux d'énergie en direct. Production ${fmtKw(prod)}, consommation ${fmtKw(cons)}. ${parts.join(', ') || 'Aucun flux'}.`
}
