import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '../utils'
import { fmtInt, fmtMonth, fmtPct, parseISODate } from './chart_utils'

export type CohortData = { cohort: string; size: number; retention: (number | null)[] }

const longMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })

/**
 * Heatmap de rétention par cohorte mensuelle (une teinte, du clair au foncé), cellule survolée détaillée.
 * Friction traitée : un churn moyen masque les cohortes qui décrochent ; ici on voit d'un coup d'œil
 * quelle génération de clients part plus vite, et à quel mois de vie.
 * Clavier : Tab entre dans la grille, flèches pour se déplacer, la cellule active est décrite sous le tableau.
 */
export function CohortHeatmap({
  rows,
  columnPrefix = 'M',
  min,
  cohortLabel = 'Cohorte',
  sizeLabel = 'Foyers',
  ariaLabel,
  valueNoun = 'retenus',
  metricLabel = 'Rétention',
  describe,
  className,
}: {
  rows: CohortData[]
  /** Ce que mesure la cellule, pour les lecteurs d'écran (« retenus », « en mode Smart »…). */
  valueNoun?: string
  /** Nom de la métrique dans le résumé (« Rétention », « Activation du mode Smart »…). */
  metricLabel?: string
  /** Détail personnalisé de la cellule active (par défaut : résiliations et moyenne de la colonne). */
  describe?: (cell: {
    row: CohortData
    value: number
    column: number
    columnAverage: number | null
  }) => ReactNode
  /** Préfixe des colonnes : M1, M2… (mois de vie). */
  columnPrefix?: string
  /** Borne basse de l'échelle (par défaut : plus petite valeur observée). */
  min?: number
  cohortLabel?: string
  sizeLabel?: string
  ariaLabel?: string
  className?: string
}) {
  const cols = Math.max(...rows.map((r) => r.retention.length))
  const values = rows.flatMap((r) => r.retention.filter((v): v is number => v !== null))
  const lo = min ?? Math.floor(Math.min(...values))
  const [active, setActive] = useState<{ r: number; c: number } | null>(null)
  const [focus, setFocus] = useState({ r: 0, c: 0 })
  const cells = useRef(new Map<string, HTMLTableCellElement>())

  const colAvg = Array.from({ length: cols }, (_, c) => {
    const vs = rows
      .map((r) => r.retention[c])
      .filter((v): v is number => v !== null && v !== undefined)
    return vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null
  })
  /*
   * Teinte de cellule (8 → 92 % de primary). Entre ≈ 57 % et 63 %, ni l'encre ni le blanc n'atteignent 4,5:1 (A11Y-CONTRAST) :
   * on saute cette bande (56 % → encre 4,6:1 ; 64 % → blanc 4,6:1, mesurés sur les tokens).
   */
  const mix = (v: number) => {
    const p = 8 + ((v - lo) / Math.max(0.01, 100 - lo)) * 84
    return p > 56 && p < 64 ? (p < 60 ? 56 : 64) : p
  }
  const worstRow = rows.reduce(
    (w, r, i) => {
      const v = r.retention[2]
      return v !== null && v !== undefined && v < w.v ? { i, v } : w
    },
    { i: -1, v: Infinity }
  )
  const auto = `${metricLabel} de ${rows.length} cohortes mensuelles, de ${fmtMonth(rows[0].cohort)} à ${fmtMonth(rows[rows.length - 1]!.cohort)}. Valeurs de ${fmtPct(Math.min(...values))} à ${fmtPct(Math.max(...values))}.${
    worstRow.i >= 0
      ? ` Cohorte la plus basse à ${columnPrefix}3 : ${longMonth.format(parseISODate(rows[worstRow.i].cohort))} (${fmtPct(worstRow.v)}).`
      : ''
  }`

  const move = (e: KeyboardEvent, r: number, c: number) => {
    const d: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    }
    const step = d[e.key]
    if (e.key === 'Escape') return setActive(null)
    if (!step) return
    e.preventDefault()
    let nr = Math.min(rows.length - 1, Math.max(0, r + step[0]))
    let nc = Math.min(cols - 1, Math.max(0, c + step[1]))
    // on reste sur une cellule renseignée
    while ((rows[nr].retention[nc] ?? null) === null && nc > 0) nc--
    if ((rows[nr].retention[nc] ?? null) === null) nr = r
    setFocus({ r: nr, c: nc })
    setActive({ r: nr, c: nc })
    cells.current.get(`${nr}-${nc}`)?.focus()
  }

  const sel = active
    ? { row: rows[active.r], v: rows[active.r].retention[active.c]!, c: active.c }
    : null

  return (
    <div className={cx('min-w-0', className)}>
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[36rem] border-separate border-spacing-0.5 text-xs tabular-nums"
          aria-label={ariaLabel ?? auto}
        >
          <thead>
            <tr>
              <th scope="col" className="px-2 py-1 text-left font-medium text-ink-muted">
                {cohortLabel}
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium text-ink-muted">
                {sizeLabel}
              </th>
              {Array.from({ length: cols }, (_, c) => (
                <th
                  key={c}
                  scope="col"
                  className="px-1 py-1 text-center font-medium text-ink-muted"
                >
                  {columnPrefix}
                  {c + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody onMouseLeave={() => setActive(null)}>
            {rows.map((row, r) => (
              <tr key={row.cohort}>
                <th
                  scope="row"
                  className={cx(
                    'px-2 py-1 text-left font-medium whitespace-nowrap',
                    active?.r === r ? 'text-ink' : 'text-ink-muted'
                  )}
                >
                  {fmtMonth(row.cohort)}
                </th>
                <td className="px-2 py-1 text-right text-ink-muted">{fmtInt(row.size)}</td>
                {Array.from({ length: cols }, (_, c) => {
                  const v = row.retention[c]
                  if (v === null || v === undefined)
                    return <td key={c} aria-hidden className="h-8" />
                  const p = mix(v)
                  const isActive = active?.r === r && active.c === c
                  const dimmed = active && !isActive && active.r !== r && active.c !== c
                  return (
                    <td
                      key={c}
                      ref={(n) => {
                        if (n) cells.current.set(`${r}-${c}`, n)
                      }}
                      tabIndex={focus.r === r && focus.c === c ? 0 : -1}
                      aria-label={`Cohorte ${longMonth.format(parseISODate(row.cohort))}, ${columnPrefix}${c + 1} : ${fmtPct(v)} ${valueNoun}`}
                      onMouseEnter={() => setActive({ r, c })}
                      onFocus={() => {
                        setFocus({ r, c })
                        setActive({ r, c })
                      }}
                      onKeyDown={(e) => move(e, r, c)}
                      className={cx(
                        'h-8 min-w-10 cursor-default rounded-[3px] px-1 text-center transition-opacity outline-none',
                        isActive && 'ring-2 ring-ink ring-offset-1 ring-offset-surface',
                        dimmed && 'opacity-60'
                      )}
                      style={{
                        background: `color-mix(in oklab, var(--color-primary) ${p.toFixed(0)}%, var(--color-surface))`,
                        color: p >= 64 ? 'var(--color-primary-contrast)' : 'var(--color-ink)',
                      }}
                    >
                      {v.toFixed(0)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-h-10 text-sm text-ink" aria-live="polite">
          {sel && describe ? (
            describe({ row: sel.row, value: sel.v, column: sel.c, columnAverage: colAvg[sel.c] })
          ) : sel ? (
            <>
              <span className="font-semibold">
                {longMonth.format(parseISODate(sel.row.cohort))}, {columnPrefix}
                {sel.c + 1} : {fmtPct(sel.v)}
              </span>{' '}
              <span className="text-ink-muted">
                encore clients, soit {fmtInt((sel.row.size * (100 - sel.v)) / 100)} résiliations sur{' '}
                {fmtInt(sel.row.size)} foyers.
                {colAvg[sel.c] !== null && (
                  <>
                    {' '}
                    Moyenne {columnPrefix}
                    {sel.c + 1} : {fmtPct(colAvg[sel.c]!)} (
                    {sel.v >= colAvg[sel.c]! ? 'au-dessus' : 'en dessous'}).
                  </>
                )}
              </span>
            </>
          ) : (
            <span className="text-ink-muted">
              Survolez ou parcourez une cellule au clavier pour le détail.
            </span>
          )}
        </p>
        <div className="flex shrink-0 items-center gap-2 text-xs text-ink-muted" aria-hidden>
          <span className="tabular-nums">{lo} %</span>
          <span
            className="h-2 w-28 rounded-full"
            style={{
              background: `linear-gradient(90deg, color-mix(in oklab, var(--color-primary) 8%, var(--color-surface)), var(--color-primary))`,
            }}
          />
          <span className="tabular-nums">100 %</span>
        </div>
      </div>
    </div>
  )
}
