import { cx } from '../utils'

/** Bloc de chargement. Toujours à la forme du contenu final (même hauteur, même rayon). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={cx('kit-shimmer rounded-sm bg-skeleton', className)} />
}

export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cx('space-y-2', className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cx('h-3', i === lines - 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </div>
  )
}

/** Carte KPI en chargement : libellé, gros chiffre, ligne de contexte. */
export function SkeletonStat({ className = '' }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Chargement"
      className={cx('rounded-md border border-line bg-surface p-5 shadow-card', className)}
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-9 w-32" />
      <Skeleton className="mt-3 h-3 w-40" />
    </div>
  )
}

/** Graphe en chargement : axe + barres de hauteurs variées. */
export function SkeletonChart({
  bars = 12,
  className = '',
}: {
  bars?: number
  className?: string
}) {
  const heights = [40, 55, 70, 85, 95, 100, 92, 78, 60, 45, 35, 30, 28, 34]
  return (
    <div
      role="status"
      aria-label="Chargement du graphique"
      className={cx(
        'flex h-40 items-end gap-1.5 rounded-md border border-line bg-surface p-4',
        className
      )}
    >
      {Array.from({ length: bars }, (_, i) => (
        <div key={i} className="flex-1" style={{ height: `${heights[i % heights.length]}%` }}>
          <Skeleton className="h-full w-full" />
        </div>
      ))}
    </div>
  )
}
