import { Form } from '@adonisjs/inertia/react'
import { Head, usePoll } from '@inertiajs/react'
import { Activity, Cake, FlaskConical, QrCode, RotateCcw, type LucideIcon } from 'lucide-react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useState, type KeyboardEvent } from 'react'
import { AnimatedNumber, cx } from '~/kit'
import { duration, ease, fadeUp, softSpring, spring, stagger } from '~/kit/motion'
import { AbPanel, type AbTest } from '~/components/ab_panel'
import { BoShell, LiveDot } from '~/components/bo_shell'
import {
  SLIDE_LABELS,
  SharedSlidesPanel,
  type SharesBySlide,
} from '~/components/shared_slides_panel'
import { FleetPanel, KpiFlash, feedItem, type Fleet } from '~/components/fleet_panel'
import type { InertiaProps } from '~/types'

type FeedItem = {
  prenom: string
  ville: string
  type: string
  props: Record<string, string | number | boolean>
  at: number
}
type PageProps = InertiaProps<{
  kpis: { visitors: number; activations: number; compensatedEur: number; winnersRate: number }
  funnel: { step: string; count: number }[]
  formulas: { upgrades: number; downgrades: number; tried300ThenLeft: number }
  feed: FeedItem[]
  demoUrl: string
  qrSvg: string
  fleet: Fleet
  abTest: AbTest
  sharesBySlide: SharesBySlide
}>

const LEVERS: Record<string, string> = {
  msp: 'MySmartPilot',
  ballon_midi: 'le ballon à midi',
  electromenager: 'l’électroménager en journée',
}
const CARDS: Record<string, string> = {
  jours_sans_reseau: 'ses jours sans réseau',
  record: 'son record',
  valeur_nette: 'la valeur de sa batterie virtuelle',
  co2: 'son CO₂ évité',
  autoconsommation: 'son autoconsommation',
  trophees: 'ses trophées',
  meilleur_jour: 'sa meilleure journée',
}

function describe({ type, props }: FeedItem) {
  switch (type) {
    case 'page_vue':
      return props.page === 'retro' ? 'a ouvert sa rétro' : 'prépare son année 2'
    case 'carte_vue':
      return `a vu ${CARDS[String(props.carte)] ?? 'une carte'}`
    case 'hausse_vue':
      return `a vu la hausse du 1er novembre (+${Math.round(Number(props.delta_eur))} €)`
    case 'levier_bascule':
      return `a ${props.actif ? 'activé' : 'désactivé'} ${LEVERS[String(props.levier)]} (${Number(props.delta_eur) >= 0 ? '+' : ''}${props.delta_eur} €/an)`
    case 'capacite_changee':
      return `a essayé ${props.vers} kWh au lieu de ${props.de} (${props.sens})`
    case 'bascule_gagnante':
      return `est gagnant·e malgré la hausse (+${props.delta_eur} €/an)`
    case 'vue_changee':
      return `a basculé sa rétro en vue ${props.vue === 'impact' ? 'impact' : 'économies'}`
    case 'partage_retro':
      return `a partagé « ${SLIDE_LABELS[String(props.slide)] ?? 'sa rétro'} »`
    case 'partage_ouvert':
      return `a ouvert un lien partagé${SLIDE_LABELS[String(props.slide)] ? ` (« ${SLIDE_LABELS[String(props.slide)]} »)` : ''}`
    case 'activation_demandee':
      return `a demandé l’activation de MySmartPilot (+${Math.round(Number(props.gain_eur_an))} €/an)`
    default:
      return type
  }
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n > 1 ? many : one}`
}

function ago(at: number) {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000))
  return s < 60 ? `il y a ${s} s` : `il y a ${Math.round(s / 60)} min`
}

type TabId = 'kpi' | 'usage' | 'ab'
const TABS: { id: TabId; label: string; icon: LucideIcon; hint: string }[] = [
  {
    id: 'kpi',
    label: 'KPI anniversaire',
    icon: Cake,
    hint: 'La salle teste la page anniversaire : chaque geste remonte ici en 2 s.',
  },
  {
    id: 'usage',
    label: 'Usage global',
    icon: Activity,
    hint: 'Projection sur tout le parc mylight150 : données simulées, séparées de la salle.',
  },
  {
    id: 'ab',
    label: 'Test A/B',
    icon: FlaskConical,
    hint: 'Rétro en euros contre rétro en impact : une variante par visiteur, tirée à 50/50.',
  },
]

const isTab = (v: string | null): v is TabId => v === 'kpi' || v === 'usage' || v === 'ab'

/** Onglet initial lu dans ?onglet= : permet d’ouvrir le pitch directement sur le bon écran. */
function initialTab(): TabId {
  if (typeof window === 'undefined') return 'kpi'
  const v = new URLSearchParams(window.location.search).get('onglet')
  return isTab(v) ? v : 'kpi'
}

/** Variantes nommées : les panneaux enfants en `fadeUp` (FleetPanel) reçoivent bien « show ». */
const panel = {
  variants: {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } },
    exit: { opacity: 0, y: -4, transition: { duration: duration.fast, ease: ease.out } },
  },
  initial: 'hidden',
  animate: 'show',
  exit: 'exit',
} as const

/** Écran 3 : back-office live (état en mémoire, partagé par tous les visiteurs). */
export default function Admin({
  kpis,
  funnel,
  formulas,
  feed,
  demoUrl,
  qrSvg,
  fleet,
  abTest,
  sharesBySlide,
}: PageProps) {
  usePoll(2000)
  const [tab, setTab] = useState<TabId>(initialTab)
  const current = TABS.find((t) => t.id === tab)!

  const select = (id: TabId) => {
    setTab(id)
    const url = new URL(window.location.href)
    url.searchParams.set('onglet', id)
    window.history.replaceState(window.history.state, '', url)
  }

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const i = TABS.findIndex((t) => t.id === tab)
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
    select(next.id)
    document.getElementById(`tab-${next.id}`)?.focus()
  }

  const counts: Record<TabId, string> = {
    kpi: String(kpis.visitors),
    usage: 'simulé',
    ab: String(abTest.n.euros + abTest.n.impact),
  }

  return (
    <MotionConfig reducedMotion="user">
      <Head title="Pilotage en direct · Anniversaires" />
      <BoShell actions={<ResetDemo />}>
        <motion.div
          variants={stagger(0.06)}
          initial="hidden"
          animate="show"
          className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8"
        >
          <motion.header variants={fadeUp} className="flex flex-col gap-3">
            <p className="text-sm font-medium text-primary">Campagne · 1 an d’installation</p>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-1.5">
                <h1 className="text-3xl font-semibold tracking-tight">Anniversaires</h1>
                <p className="flex items-center gap-2 text-sm text-ink-muted">
                  <LiveDot />
                  Salle en direct · mis à jour toutes les 2 s
                </p>
              </div>
              <p className="rounded-full bg-surface px-3 py-1 text-sm font-medium ring-1 ring-line">
                Profils de démonstration · les gestes de la salle sont réels
              </p>
            </div>
          </motion.header>

          <motion.div variants={fadeUp} className="border-b border-line">
            <div
              role="tablist"
              aria-label="Vues du pilotage"
              className="-mb-px flex gap-1 overflow-x-auto"
            >
              {TABS.map((t) => {
                const active = t.id === tab
                const Icon = t.icon
                return (
                  <button
                    key={t.id}
                    id={`tab-${t.id}`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls={`panel-${t.id}`}
                    tabIndex={active ? 0 : -1}
                    onClick={() => select(t.id)}
                    onKeyDown={onTabKey}
                    className={cx(
                      'relative flex min-h-12 shrink-0 items-center gap-2 px-4 text-sm font-medium whitespace-nowrap transition-colors',
                      'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                      active ? 'text-ink' : 'text-ink-muted hover:text-ink'
                    )}
                  >
                    <Icon className={cx('size-4', active && 'text-primary')} aria-hidden="true" />
                    {t.label}
                    <span
                      className={cx(
                        'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'bg-canvas text-ink-muted ring-1 ring-line'
                      )}
                    >
                      {counts[t.id]}
                    </span>
                    {active && (
                      <motion.span
                        layoutId="bo-tab-underline"
                        className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary"
                        transition={spring}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </motion.div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.section
              key={tab}
              id={`panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
              className="flex flex-col gap-6"
              {...panel}
            >
              <p className="text-sm text-ink-muted">{current.hint}</p>
              {tab === 'kpi' && (
                <KpiTab
                  kpis={kpis}
                  funnel={funnel}
                  formulas={formulas}
                  feed={feed}
                  demoUrl={demoUrl}
                  qrSvg={qrSvg}
                  sharesBySlide={sharesBySlide}
                />
              )}
              {tab === 'usage' && <FleetPanel fleet={fleet} />}
              {tab === 'ab' && <AbPanel abTest={abTest} />}
            </motion.section>
          </AnimatePresence>
        </motion.div>
      </BoShell>
    </MotionConfig>
  )
}

/** Réinitialisation en 2 temps : un clic maladroit en plein pitch ne vide pas l’écran. */
function ResetDemo() {
  const [confirming, setConfirming] = useState(false)
  return (
    <Form route="admin.execute" onFinish={() => setConfirming(false)}>
      {({ processing }) =>
        confirming ? (
          <div
            className="flex items-center gap-2"
            role="group"
            aria-label="Confirmer la réinitialisation"
          >
            <p className="hidden text-sm md:block">Effacer la salle et le parc simulé ?</p>
            <button
              type="submit"
              disabled={processing}
              className="min-h-9 rounded-md bg-danger px-3 text-sm font-semibold text-primary-contrast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:opacity-60"
            >
              {processing ? 'Réinitialisation…' : 'Oui, tout effacer'}
            </button>
            <button
              type="button"
              disabled={processing}
              onClick={() => setConfirming(false)}
              className="min-h-9 rounded-md px-3 text-sm text-ink-muted ring-1 ring-line hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-ink-muted ring-1 ring-line hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Réinitialiser la démo
          </button>
        )
      }
    </Form>
  )
}

function KpiTab({
  kpis,
  funnel,
  formulas,
  feed,
  demoUrl,
  qrSvg,
  sharesBySlide,
}: Pick<
  PageProps,
  'kpis' | 'funnel' | 'formulas' | 'feed' | 'demoUrl' | 'qrSvg' | 'sharesBySlide'
>) {
  const top = Math.max(1, ...funnel.map((f) => f.count))
  const card = 'rounded-lg border border-line bg-surface p-5 shadow-card'

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <h2 className="sr-only">Chiffres de la salle</h2>
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Visiteurs', value: kpis.visitors, suffix: '' },
            { label: 'Activations MSP demandées', value: kpis.activations, suffix: '' },
            { label: 'Hausse compensée', value: kpis.compensatedEur, suffix: ' €/an' },
            { label: 'Gagnants malgré le 1/11', value: kpis.winnersRate, suffix: ' %' },
          ].map((k) => (
            <div key={k.label} className={cx('relative flex flex-col gap-2', card)}>
              <KpiFlash value={k.value} />
              <dt className="relative text-sm text-ink-muted">{k.label}</dt>
              <dd className="relative text-3xl font-semibold tracking-tight tabular-nums">
                <AnimatedNumber value={k.value} suffix={k.suffix} />
              </dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className={cx('flex flex-col gap-3', card)} aria-label="Parcours des visiteurs">
            <h2 className="font-semibold">Parcours des visiteurs</h2>
            {funnel.map((f) => (
              <div key={f.step} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span>{f.step}</span>
                  <span className="font-semibold tabular-nums">{f.count}</span>
                </div>
                <div className="h-2 rounded-full bg-gauge-track" aria-hidden="true">
                  <motion.div
                    className="h-2 rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${(f.count / top) * 100}%` }}
                    transition={softSpring}
                  />
                </div>
              </div>
            ))}
            <div className="mt-2 border-t border-line pt-4">
              <h3 className="font-semibold">Formules de batterie virtuelle</h3>
              <p className="mt-1 text-sm text-ink-muted">
                {plural(
                  formulas.upgrades,
                  'formule supérieure essayée',
                  'formules supérieures essayées'
                )}{' '}
                ·{' '}
                {plural(
                  formulas.downgrades,
                  'formule inférieure essayée',
                  'formules inférieures essayées'
                )}{' '}
                ·{' '}
                {plural(
                  formulas.tried300ThenLeft,
                  'a essayé 300 kWh puis est revenu',
                  'ont essayé 300 kWh puis sont revenus'
                )}
              </p>
            </div>
          </section>

          <section className={cx('flex flex-col gap-3', card)} aria-label="Flux live">
            <h2 className="flex items-center gap-2 font-semibold">
              <LiveDot />
              En direct
            </h2>
            {feed.length === 0 ? (
              <p className="text-base text-ink-muted">
                Scannez le QR code : les gestes de la salle apparaissent ici.
              </p>
            ) : (
              <ul className="relative flex flex-col divide-y divide-line text-base">
                <AnimatePresence initial={false} mode="popLayout">
                  {feed.map((e) => (
                    <motion.li key={`${e.at}-${e.prenom}-${e.type}`} className="py-2" {...feedItem}>
                      <span className="font-semibold">
                        {e.prenom} · {e.ville}
                      </span>{' '}
                      {describe(e)} <span className="text-ink-muted">· {ago(e.at)}</span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </section>
        </div>

        <SharedSlidesPanel sharesBySlide={sharesBySlide} />
      </div>

      <aside
        className={cx('flex h-fit flex-col gap-4 xl:sticky xl:top-24', card)}
        aria-label="Accès à la démo"
      >
        <h2 className="flex items-center gap-2 font-semibold">
          <QrCode className="size-4 text-primary" aria-hidden="true" />
          Accès salle
        </h2>
        <div
          className="mx-auto aspect-square w-full max-w-64 rounded-md bg-white p-2 ring-1 ring-line [&_svg]:size-full"
          role="img"
          aria-label={`QR code vers ${demoUrl}`}
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="text-xl font-semibold tracking-tight">
          Scannez, activez MySmartPilot, regardez le chiffre bouger
        </p>
        <p className="break-all text-base text-ink-muted">{demoUrl}</p>
      </aside>
    </div>
  )
}
