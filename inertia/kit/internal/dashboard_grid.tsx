import type { ReactNode } from 'react'
import { cx } from '../utils'

const COLS = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
  4: 'grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4',
  6: 'grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6',
} as const

/**
 * Grille de tableau de bord responsive (1 → 6 colonnes selon la largeur).
 * Friction traitée : un dashboard qui se casse sur portable ou s'étire sur grand écran ; ici la densité reste lisible partout.
 * `DashboardPanel` permet à un bloc de s'étendre sur plusieurs colonnes.
 */
export function DashboardGrid({
  cols = 4,
  children,
  className,
}: {
  cols?: keyof typeof COLS
  children: ReactNode
  className?: string
}) {
  return <div className={cx('grid gap-4', COLS[cols], className)}>{children}</div>
}

const SPAN = {
  1: '',
  2: 'md:col-span-2',
  3: 'md:col-span-2 xl:col-span-3',
  full: 'col-span-full',
} as const

/**
 * Bloc de tableau de bord : titre, sous-titre, action à droite, contenu. S'étend sur `span` colonnes.
 * Friction traitée : des graphiques sans titre ni contexte (« c'est quoi cette courbe ? »).
 */
export function DashboardPanel({
  title,
  subtitle,
  actions,
  span = 1,
  children,
  className,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  span?: keyof typeof SPAN
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cx(
        'min-w-0 rounded-md border border-line bg-surface p-4 shadow-card sm:p-5',
        SPAN[span],
        className
      )}
    >
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {title && <h4 className="text-sm font-semibold text-ink">{title}</h4>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

/**
 * Section de tableau de bord : titre, description, actions (filtres, export) sur une seule ligne au-dessus du contenu.
 * Friction traitée : des filtres dispersés dans chaque carte ; ici ils sont au-dessus de tout ce qu'ils filtrent.
 */
export function DashboardSection({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={cx('min-w-0 scroll-mt-20', className)}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">
            {title}
          </h3>
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}
