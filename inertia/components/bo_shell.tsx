import {
  Bell,
  Cake,
  ChevronRight,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Receipt,
  Search,
  Settings,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { cx, ease } from '~/kit'

type NavItem = { label: string; icon: LucideIcon; active?: boolean; badge?: string }

/** Menu simulé du back-office : seule l’entrée Anniversaires est branchée. */
const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Pilotage',
    items: [
      { label: 'Vue d’ensemble', icon: LayoutDashboard },
      { label: 'Clients', icon: Users },
      { label: 'Parc installé', icon: Sun },
      { label: 'Facturation', icon: Receipt },
    ],
  },
  {
    group: 'Engagement',
    items: [
      { label: 'Campagnes', icon: Megaphone },
      { label: 'Anniversaires', icon: Cake, active: true, badge: 'Live' },
    ],
  },
  {
    group: 'Compte',
    items: [
      { label: 'Paramètres', icon: Settings },
      { label: 'Support', icon: LifeBuoy },
    ],
  },
]

/** Point vert qui pulse : signale le poll de 2 s, seul élément animé en continu. */
export function LiveDot() {
  const reduce = useReducedMotion()
  return (
    <span className="relative inline-flex size-2" aria-hidden="true">
      {!reduce && (
        <motion.span
          className="absolute inset-0 rounded-full bg-win"
          animate={{ scale: [1, 2.4], opacity: [0.5, 0] }}
          transition={{ duration: 1.6, ease: ease.out, repeat: Infinity }}
        />
      )}
      <span className="relative size-2 rounded-full bg-win" />
    </span>
  )
}

/**
 * Cadre SaaS du back-office : menu latéral simulé, fil d’Ariane, barre d’actions.
 * Friction traitée : une page isolée ne dit pas « outil interne mylight150 » ; le cadre situe
 * la feature Anniversaires dans un vrai pilotage, sans faire croire que le reste existe.
 */
export function BoShell({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-line px-5">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-contrast">
            <Sun className="size-4.5" aria-hidden="true" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">mylight150</span>
            <span className="text-xs text-ink-muted">Back-office</span>
          </span>
        </div>

        <div className="px-3 pt-4">
          <div
            className="flex h-9 items-center gap-2 rounded-md bg-canvas px-3 text-sm text-ink-muted ring-1 ring-line"
            aria-hidden="true"
          >
            <Search className="size-4" />
            <span className="flex-1">Rechercher</span>
            <kbd className="rounded-sm bg-surface px-1.5 font-sans text-xs ring-1 ring-line">
              ⌘K
            </kbd>
          </div>
        </div>

        <nav
          className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-5"
          aria-label="Back-office"
        >
          {NAV.map((section) => (
            <div key={section.group} className="flex flex-col gap-0.5">
              <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                {section.group}
              </p>
              {section.items.map((item) => (
                <NavEntry key={item.label} item={item} />
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-4">
          <p className="rounded-md border border-dashed border-proj-border px-3 py-2 text-xs text-ink-muted">
            Menu simulé pour la démo : seule l’entrée Anniversaires est branchée.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-sky text-xs font-semibold text-primary">
              CRM
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-medium">Équipe CRM</span>
              <span className="text-xs text-ink-muted">Rôle : pilotage</span>
            </span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-line bg-surface/90 px-4 backdrop-blur md:px-8">
          <nav aria-label="Fil d’Ariane" className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="text-ink-muted">Engagement</span>
            <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
            <span className="truncate font-medium" aria-current="page">
              Anniversaires
            </span>
          </nav>
          <div className="flex items-center gap-2">
            {actions}
            <span
              className="hidden size-9 place-items-center rounded-md text-ink-muted ring-1 ring-line sm:grid"
              aria-hidden="true"
            >
              <Bell className="size-4" />
            </span>
          </div>
        </header>
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  )
}

function NavEntry({ item }: { item: NavItem }) {
  const Icon = item.icon
  if (!item.active) {
    return (
      <span
        aria-disabled="true"
        title="Non simulé dans cette démo"
        className="flex h-9 cursor-not-allowed items-center gap-3 rounded-md px-3 text-sm text-ink-muted/70"
      >
        <Icon className="size-4" aria-hidden="true" />
        {item.label}
      </span>
    )
  }
  return (
    <a
      href="/admin"
      aria-current="page"
      className={cx(
        'relative flex h-9 items-center gap-3 rounded-md bg-primary/10 px-3 text-sm font-semibold text-primary',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
      )}
    >
      <span
        className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary"
        aria-hidden="true"
      />
      <Icon className="size-4" aria-hidden="true" />
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span className="flex items-center gap-1.5 rounded-full bg-win-surface px-2 py-0.5 text-xs font-semibold text-win">
          <LiveDot />
          {item.badge}
        </span>
      )}
    </a>
  )
}
