import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Term } from '../../components/explain'
import { duration, ease } from '../../motion'
import { cx } from '../../utils'
import { ChartTooltip, DataTable, TipRow, fmtKwh, fmtPct, useElementWidth } from './shared'

export type SankeySourceId = 'solar' | 'virtual' | 'grid'
export type SankeyUseId = 'home' | 'waterHeater' | 'heatPump' | 'ev' | 'stored' | 'exported'
export type SankeyFlow = { from: SankeySourceId; to: SankeyUseId; kwh: number }
/** Équipements présents : un bloc n'apparaît que si l'équipement existe (piloté par Robin). */
export type SankeyEquipment = {
  waterHeater?: boolean
  heatPump?: boolean
  ev?: boolean
  virtualBattery?: boolean
}

const SOURCES: SankeySourceId[] = ['solar', 'virtual', 'grid']
const USES: SankeyUseId[] = ['home', 'waterHeater', 'heatPump', 'ev', 'stored', 'exported']

const DEFAULT_LABELS: Record<SankeySourceId | SankeyUseId, string> = {
  solar: 'Solaire',
  virtual: 'Batterie virtuelle',
  grid: 'Réseau',
  home: 'Usages courants',
  waterHeater: 'Chauffe-eau piloté',
  heatPump: 'Pompe à chaleur',
  ev: 'Voiture',
  stored: 'Stocké virtuellement',
  exported: 'Injecté',
}

const NODE_COLOR: Record<SankeySourceId | SankeyUseId, string> = {
  solar: 'var(--color-solar)',
  virtual: 'var(--color-battery)',
  grid: 'var(--color-grid)',
  home: 'var(--color-home)',
  waterHeater: 'var(--color-home)',
  heatPump: 'var(--color-home)',
  ev: 'var(--color-home)',
  stored: 'var(--color-battery)',
  exported: 'var(--color-grid)',
}

/* Septembre 2026, famille Martin (6 kWc, Villeurbanne) : 650 kWh produits. */
const DEFAULT_FLOWS: SankeyFlow[] = [
  { from: 'solar', to: 'home', kwh: 150 },
  { from: 'solar', to: 'waterHeater', kwh: 85 },
  { from: 'solar', to: 'heatPump', kwh: 20 },
  { from: 'solar', to: 'ev', kwh: 95 },
  { from: 'solar', to: 'stored', kwh: 260 },
  { from: 'solar', to: 'exported', kwh: 40 },
  { from: 'virtual', to: 'home', kwh: 70 },
  { from: 'virtual', to: 'heatPump', kwh: 15 },
  { from: 'virtual', to: 'ev', kwh: 35 },
  { from: 'grid', to: 'home', kwh: 25 },
  { from: 'grid', to: 'heatPump', kwh: 20 },
]

const CONSUMING: SankeyUseId[] = ['home', 'waterHeater', 'heatPump', 'ev']

/**
 * Bilan mensuel en Sankey : sources (solaire, batterie virtuelle, réseau) → usages (usages courants, chauffe-eau piloté,
 * PAC, voiture, stocké virtuellement, injecté). Les blocs n'existent que si l'équipement est présent.
 * Survol ou focus d'un flux : kWh + part de la source.
 *
 * Friction traitée : « où est passé mon soleil ? » ; la production disparaît dans un total, le Sankey montre chaque kWh arriver à un usage.
 * Pattern : P4 (Energy Dashboard pour Homey, blocs PAC / VE affichés seulement s'ils sont détectés)
 */
export function EnergySankey({
  flows = DEFAULT_FLOWS,
  equipment = { waterHeater: true, heatPump: true, ev: true, virtualBattery: true },
  period = 'Septembre 2026',
  labels,
  className,
}: {
  flows?: SankeyFlow[]
  equipment?: SankeyEquipment
  /** Libellé de la période affichée. */
  period?: string
  labels?: Partial<Record<SankeySourceId | SankeyUseId, string>>
  className?: string
}) {
  const l = { ...DEFAULT_LABELS, ...labels }
  const reduce = useReducedMotion()
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(640)
  const [hover, setHover] = useState<number | null>(null)

  const present = (id: SankeySourceId | SankeyUseId) => {
    if (id === 'waterHeater') return equipment.waterHeater !== false
    if (id === 'heatPump') return equipment.heatPump !== false
    if (id === 'ev') return equipment.ev !== false
    if (id === 'virtual' || id === 'stored') return equipment.virtualBattery !== false
    return true
  }
  const live = flows.filter((f) => f.kwh > 0 && present(f.from) && present(f.to))

  const srcTotal = (s: SankeySourceId) =>
    live.filter((f) => f.from === s).reduce((a, f) => a + f.kwh, 0)
  const totalFor = (u: SankeyUseId) => live.filter((f) => f.to === u).reduce((a, f) => a + f.kwh, 0)
  const srcs = SOURCES.filter((s) => srcTotal(s) > 0)
  const uses = USES.filter((u) => totalFor(u) > 0)

  /* --- Mise en page en pixels réels --- */
  const narrow = width < 520
  const nodeW = 10
  const labelL = narrow ? 106 : 132
  const labelR = narrow ? 116 : 168
  const gap = 18
  const H = narrow ? 340 : 320
  const total = Math.max(
    srcs.reduce((a, s) => a + srcTotal(s), 0),
    uses.reduce((a, u) => a + totalFor(u), 0)
  )
  const scale = (H - 8 - gap * Math.max(uses.length - 1, srcs.length - 1, 0)) / Math.max(1, total)
  const xL = labelL
  const xR = width - labelR - nodeW

  const layout = (ids: string[], sum: (id: string) => number) => {
    const heights = ids.map((id) => sum(id) * scale)
    const used = heights.reduce((a, h) => a + h, 0) + gap * (ids.length - 1)
    let y = (H - used) / 2
    const out: Record<string, { y: number; h: number }> = {}
    ids.forEach((id, i) => {
      out[id] = { y, h: heights[i] }
      y += heights[i] + gap
    })
    return out
  }
  const L = layout(srcs, (id) => srcTotal(id as SankeySourceId))
  const R = layout(uses, (id) => totalFor(id as SankeyUseId))

  // Ordonne les rubans pour limiter les croisements : côté source dans l'ordre des usages, côté usage dans l'ordre des sources.
  const bySrc = [...live].sort(
    (a, b) =>
      SOURCES.indexOf(a.from) - SOURCES.indexOf(b.from) || USES.indexOf(a.to) - USES.indexOf(b.to)
  )
  const byUse = [...live].sort(
    (a, b) =>
      USES.indexOf(a.to) - USES.indexOf(b.to) || SOURCES.indexOf(a.from) - SOURCES.indexOf(b.from)
  )
  const y0Of = new Map<SankeyFlow, number>()
  const y1Of = new Map<SankeyFlow, number>()
  const outOff: Record<string, number> = {}
  const inOff: Record<string, number> = {}
  bySrc.forEach((f) => {
    y0Of.set(f, L[f.from].y + (outOff[f.from] ?? 0))
    outOff[f.from] = (outOff[f.from] ?? 0) + f.kwh * scale
  })
  byUse.forEach((f) => {
    y1Of.set(f, R[f.to].y + (inOff[f.to] ?? 0))
    inOff[f.to] = (inOff[f.to] ?? 0) + f.kwh * scale
  })
  const paths = bySrc.map((f) => {
    const h = f.kwh * scale
    const y0 = y0Of.get(f) ?? 0
    const y1 = y1Of.get(f) ?? 0
    const x0 = xL + nodeW
    const x1 = xR
    const cx0 = x0 + (x1 - x0) * 0.5
    const d = `M${x0} ${y0} C${cx0} ${y0} ${cx0} ${y1} ${x1} ${y1} L${x1} ${y1 + h} C${cx0} ${y1 + h} ${cx0} ${y0 + h} ${x0} ${y0 + h} Z`
    return { f, h, d, mid: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + h / 2 } }
  })

  const production = srcTotal('solar')
  const selfUsed = live
    .filter((f) => f.from === 'solar' && CONSUMING.includes(f.to))
    .reduce((a, f) => a + f.kwh, 0)
  const stored = totalFor('stored')
  const bought = srcTotal('grid')
  const tip = (f: SankeyFlow) => {
    const share = srcTotal(f.from) > 0 ? (f.kwh / srcTotal(f.from)) * 100 : 0
    const of =
      f.from === 'solar'
        ? 'de la production solaire'
        : f.from === 'virtual'
          ? 'du déstockage'
          : 'des achats au réseau'
    return { share, of }
  }

  const aria = `Bilan ${period}. ${srcs.map((s) => `${l[s]} ${fmtKwh(srcTotal(s))}`).join(', ')}. Vers : ${uses
    .map((u) => `${l[u]} ${fmtKwh(totalFor(u))}`)
    .join(', ')}. Tabulation pour parcourir chaque flux.`

  return (
    <div className={cx('flex flex-col gap-4', className)}>
      <dl className="grid grid-cols-3 gap-2">
        {[
          {
            k: 'Utilisé en direct',
            v: selfUsed,
            sub: `${fmtPct(production ? (selfUsed / production) * 100 : 0)} de la production`,
            c: 'bg-home',
          },
          ...(present('stored')
            ? [
                {
                  k: 'Stocké virtuellement',
                  v: stored,
                  sub: `${fmtPct(production ? (stored / production) * 100 : 0)} de la production`,
                  c: 'bg-battery',
                },
              ]
            : []),
          { k: 'Acheté au réseau', v: bought, sub: period, c: 'bg-grid' },
        ].map((s) => (
          <div key={s.k} className="min-w-0 rounded-sm border border-line bg-surface px-3 py-2">
            <dt className="flex items-start gap-1.5 text-xs leading-tight text-ink-muted">
              <span className={cx('mt-1 size-1.5 shrink-0 rounded-full', s.c)} aria-hidden />
              <span>{s.k}</span>
            </dt>
            <dd className="mt-0.5 text-base font-semibold">{fmtKwh(s.v)}</dd>
            <dd className="text-xs text-ink-muted">{s.sub}</dd>
          </div>
        ))}
      </dl>

      <div ref={wrapRef} className="relative" onPointerLeave={() => setHover(null)}>
        <svg
          width={width}
          height={H}
          role="group"
          aria-label={aria}
          className="block overflow-visible"
        >
          {paths.map((p, i) => {
            const dim = hover !== null && hover !== i
            const t = tip(p.f)
            return (
              <motion.path
                key={`${p.f.from}-${p.f.to}`}
                d={p.d}
                fill={NODE_COLOR[p.f.from]}
                tabIndex={0}
                role="img"
                aria-label={`${l[p.f.from]} vers ${l[p.f.to]} : ${fmtKwh(p.f.kwh)}, ${fmtPct(t.share)} ${t.of}`}
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                initial={{ opacity: 0 }}
                animate={{ opacity: dim ? 0.12 : hover === i ? 0.62 : 0.36 }}
                transition={{ duration: reduce ? 0 : duration.base, ease: ease.out }}
                className="cursor-pointer outline-none focus-visible:stroke-ink focus-visible:[stroke-width:1.5]"
              />
            )
          })}

          {srcs.map((s) => (
            <g key={s}>
              <rect
                x={xL}
                y={L[s].y}
                width={nodeW}
                height={Math.max(2, L[s].h)}
                rx={2}
                fill={NODE_COLOR[s]}
              />
              <NodeText
                x={xL - 8}
                y={L[s].y + L[s].h / 2}
                anchor="end"
                name={l[s]}
                value={fmtKwh(srcTotal(s))}
              />
            </g>
          ))}
          {uses.map((u) => {
            const isTerm = u === 'stored'
            return (
              <g key={u}>
                <rect
                  x={xR}
                  y={R[u].y}
                  width={nodeW}
                  height={Math.max(2, R[u].h)}
                  rx={2}
                  fill={NODE_COLOR[u]}
                />
                <NodeText
                  x={xR + nodeW + 8}
                  y={R[u].y + R[u].h / 2}
                  anchor="start"
                  name={narrow && isTerm ? 'Stocké (virtuel)' : l[u]}
                  value={`${fmtKwh(totalFor(u))} · ${fmtPct(total ? (totalFor(u) / total) * 100 : 0)}`}
                />
              </g>
            )
          })}
        </svg>

        <ChartTooltip
          show={hover !== null && !!paths[hover]}
          x={hover !== null && paths[hover] ? paths[hover].mid.x : 0}
          y={hover !== null && paths[hover] ? Math.max(0, paths[hover].mid.y - 64) : 0}
          width={width}
        >
          {hover !== null && paths[hover] && (
            <>
              <TipRow
                color={NODE_COLOR[paths[hover].f.from]}
                value={fmtKwh(paths[hover].f.kwh)}
                label={`${l[paths[hover].f.from]} → ${l[paths[hover].f.to]}`}
              />
              <p className="mt-0.5 text-ink-muted">
                {fmtPct(tip(paths[hover].f).share)} {tip(paths[hover].f).of}
              </p>
            </>
          )}
        </ChartTooltip>
      </div>

      <p className="text-xs text-ink-muted">
        La couleur d’un flux est celle de sa source.{' '}
        {present('stored') && (
          <>
            Le{' '}
            <Term def="Surplus du mois déposé dans votre batterie virtuelle : il reviendra le soir ou cet hiver, comme une épargne en kWh.">
              stocké virtuellement
            </Term>{' '}
            n’est pas perdu.
          </>
        )}
      </p>

      <DataTable
        caption={`Bilan énergétique ${period}`}
        head={['De', 'Vers', 'kWh', 'Part de la source']}
        rows={live.map((f) => [l[f.from], l[f.to], f.kwh, fmtPct(tip(f).share)])}
      />
    </div>
  )
}

function NodeText({
  x,
  y,
  anchor,
  name,
  value,
}: {
  x: number
  y: number
  anchor: 'start' | 'end'
  name: string
  value: string
}) {
  return (
    <text x={x} y={y - 2} textAnchor={anchor} fontFamily="var(--font-body)">
      <tspan x={x} fontSize="11.5" fontWeight="600" fill="var(--color-ink)">
        {name}
      </tspan>
      <tspan x={x} dy="14" fontSize="11" fill="var(--color-ink-muted)">
        {value}
      </tspan>
    </text>
  )
}
