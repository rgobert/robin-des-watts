import { Form, Link } from '@adonisjs/inertia/react'
import { Check, ChevronLeft, Lock, ShieldCheck, Sun, Trophy, Zap } from 'lucide-react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { track, useTrackOnce } from '~/components/use_track'
import {
  ActionButton,
  AssistantAvatar,
  EuroCounter,
  Term,
  WhyThis,
  WinGauge,
  cx,
  ease,
  fadeUp,
  softSpring,
  spring,
  stagger,
} from '~/kit'
import type { InertiaProps } from '~/types'

type Levers = {
  smartPilot: boolean
  heaterAtNoon: boolean
  appliancesShifted: boolean
  capacity: 20 | 100 | 300
}
type Scenario = {
  levers: Levers
  gainEur: number
  gridImportKwh: number
  selfConsumedKwh: number
}
type RankedLever = { id: string; label: string; gainEur: number; effort: string }
type PageProps = InertiaProps<{
  label: string
  priceHikeEur: number
  baseline: Levers
  scenarios: Scenario[]
  ranking: RankedLever[]
  profile: { prenom: string; ville: string }
}>

const same = (a: Levers, b: Levers) =>
  a.smartPilot === b.smartPilot &&
  a.heaterAtNoon === b.heaterAtNoon &&
  a.appliancesShifted === b.appliancesShifted &&
  a.capacity === b.capacity

const eur = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(Math.round(n))} €`

/** Paliers de l’année 2, lus sur le solde : donnent un statut à viser, pas un score. */
const tierOf = (balance: number) =>
  balance >= 150
    ? { name: 'Gagnante', tone: 'text-win bg-win-surface' }
    : balance >= 0
      ? { name: 'Protégée', tone: 'text-win bg-win-surface' }
      : { name: 'Exposée à la hausse', tone: 'text-hike bg-hike-surface' }

/**
 * Écran 2 (core) : « Mon année 2 », orienté conversion.
 * Logique intouchable : les 24 scénarios sont pré-calculés côté serveur, l’écran ne fait qu’une recherche.
 *
 * Friction traitée : Claire doit voir en un écran que la hausse du 1er novembre lui coûte de l’argent,
 * qu’un upgrade gratuit (compte piloté MySmartPilot) la compense, et l’activer. Le header porte le solde
 * vivant ; l’upgrade vient juste dessous ; les défis (gradient d’objectif + trophées adossés aux vrais
 * chiffres) prolongent l’envie d’optimiser sans rallonger l’écran.
 */
export default function NextYear({
  priceHikeEur,
  baseline,
  scenarios,
  ranking,
  profile,
}: PageProps) {
  const [levers, setLevers] = useState<Levers>(baseline)
  const [activated, setActivated] = useState(false)
  const balanceOf = (l: Levers) =>
    (scenarios.find((s) => same(s.levers, l))?.gainEur ?? 0) - priceHikeEur
  const balance = balanceOf(levers)
  const bestBalance = Math.max(...scenarios.map((s) => s.gainEur)) - priceHikeEur
  const leverGain = (id: string) => ranking.find((r) => r.id === id)?.gainEur ?? 0
  const mspGain = leverGain('msp')
  const baselineBalance = balanceOf(baseline)
  const mspBalance = balanceOf({ ...baseline, smartPilot: true })
  const tier = tierOf(balance)

  useTrackOnce('page:annee_2', 'page_vue', { page: 'annee_2' })

  /** Applies a lever change and reports it, with the delta computed from the server scenarios. */
  const apply = (next: Levers) => {
    const after = balanceOf(next)
    if (balance < 0 && after >= 0) {
      track('bascule_gagnante', { delta_eur: Math.round(after) })
    }
    setLevers(next)
    return Math.round(after + priceHikeEur)
  }

  const toggleSmartPilot = () => {
    const next = { ...levers, smartPilot: !levers.smartPilot }
    const delta = apply(next)
    track('levier_bascule', { levier: 'msp', actif: next.smartPilot, delta_eur: delta })
  }
  const toggleAppliances = () => {
    const next = { ...levers, appliancesShifted: !levers.appliancesShifted }
    const delta = apply(next)
    track('levier_bascule', {
      levier: 'electromenager',
      actif: next.appliancesShifted,
      delta_eur: delta,
    })
  }
  const toggleCapacity20 = () => {
    const capacity = levers.capacity === 20 ? baseline.capacity : 20
    const delta = apply({ ...levers, capacity })
    track('capacite_changee', {
      de: levers.capacity,
      vers: capacity,
      sens: capacity > levers.capacity ? 'upgrade' : 'downgrade',
      delta_eur: delta,
    })
  }

  const onActivated = () => {
    setActivated(true)
    if (!levers.smartPilot) apply({ ...levers, smartPilot: true })
  }

  const challenges: Challenge[] = [
    {
      id: 'msp',
      title: 'Passer en compte piloté',
      reward: eur(mspGain),
      trophy: 'Hausse compensée',
      icon: <ShieldCheck className="size-5" />,
      done: levers.smartPilot,
      onToggle: toggleSmartPilot,
    },
    {
      id: 'capacity20',
      title: 'Batterie virtuelle à 20 kWh',
      hint: 'À votre renouvellement, une fois par an',
      reward: eur(leverGain('capacity20')),
      trophy: 'Abonnement ajusté',
      icon: <Zap className="size-5" />,
      done: levers.capacity === 20,
      onToggle: toggleCapacity20,
    },
    {
      id: 'appliances',
      title: 'Électroménager en journée',
      hint: '+350 kWh de soleil gardé à la maison',
      reward: '0 €',
      trophy: 'Maison solaire+',
      icon: <Sun className="size-5" />,
      done: levers.appliancesShifted,
      onToggle: toggleAppliances,
    },
  ]
  const doneCount = challenges.filter((c) => c.done).length

  return (
    <MotionConfig reducedMotion="user">
      <motion.main
        className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-canvas px-4 pt-4 pb-28 text-ink"
        variants={stagger(0.06)}
        initial="hidden"
        animate="show"
      >
        {/* Header : le solde vivant est le titre de l’écran */}
        <motion.header
          variants={fadeUp}
          className="relative overflow-hidden rounded-lg bg-surface p-4 shadow-card"
          aria-live="polite"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -top-20 -right-16 size-52 rounded-full bg-sun-glow opacity-60 blur-3xl"
          />
          <div className="relative flex items-center justify-between gap-3">
            <Link
              route="home"
              className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-sm font-medium text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
            >
              <ChevronLeft className="size-4" aria-hidden />
              Ma rétro
            </Link>
            <motion.span
              key={tier.name}
              initial={{ scale: 0.85 }}
              animate={{ scale: 1, transition: spring }}
              className={cx('rounded-full px-3 py-1 text-xs font-semibold', tier.tone)}
            >
              {tier.name}
            </motion.span>
          </div>
          <p className="relative mt-2 text-xs font-medium tracking-wide text-ink-muted uppercase">
            Mon année 2 · {profile.prenom}
          </p>
          <h1 className="relative mt-1 text-xl leading-tight font-semibold tracking-tight">
            Le 1er novembre, vos prix montent de{' '}
            <span className="text-hike tabular-nums">{Math.round(priceHikeEur)} €</span>. Battez la
            hausse.
          </h1>
          <EuroCounter className="relative mt-2" value={balance} label="Votre solde sur un an" />
          <WinGauge
            className="relative"
            value={balance}
            baseline={-priceHikeEur}
            max={bestBalance}
          />
        </motion.header>

        {/* L’upgrade : compte piloté MySmartPilot, chiffré sur le profil */}
        <motion.section
          variants={fadeUp}
          className="relative overflow-hidden rounded-lg bg-surface p-5 shadow-card ring-2 ring-win"
          aria-labelledby="upgrade-title"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-win-surface px-3 py-1 text-xs font-semibold text-win">
              L’upgrade recommandé
            </span>
            <span className="text-xs font-semibold whitespace-nowrap text-ink-muted">
              Gratuit · sans engagement
            </span>
          </div>
          <h2 id="upgrade-title" className="mt-3 text-xl leading-tight font-semibold">
            Compte piloté MySmartPilot :{' '}
            <span className="text-win tabular-nums">{eur(mspGain)} / an</span>
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Votre{' '}
            <Term def="Votre pompe à chaleur : le plus gros consommateur pilotable de la maison.">
              PAC
            </Term>{' '}
            et votre ballon tournent au bon moment, et chaque kWh piloté remplit votre{' '}
            <Term def="0,05 € par kWh de PAC et de ballon pilotés, versés sur votre compte mylight150.">
              cagnotte
            </Term>
            .
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md bg-canvas px-3 py-2">
              <p className="text-ink-muted">Sans rien faire</p>
              <p className="font-semibold text-hike tabular-nums">{eur(baselineBalance)} / an</p>
            </div>
            <div className="rounded-md bg-win-surface px-3 py-2">
              <p className="text-ink-muted">En compte piloté</p>
              <p className="font-semibold text-win tabular-nums">{eur(mspBalance)} / an</p>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {activated ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: softSpring }}
                exit={{ opacity: 0 }}
                className="mt-4 flex items-start gap-3 rounded-md bg-win-surface p-3"
              >
                <motion.span
                  initial={{ rotate: -20, scale: 0.6 }}
                  animate={{ rotate: 0, scale: 1, transition: spring }}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-solar text-ink"
                >
                  <Trophy className="size-5" aria-hidden />
                </motion.span>
                <div className="text-sm">
                  <p className="font-semibold text-win">Trophée débloqué : Hausse compensée</p>
                  <p className="text-ink-muted">
                    Demande simulée : rien n’est envoyé pendant cette démo.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div key="cta" exit={{ opacity: 0 }} className="mt-4">
                <ActivationForm onActivated={onActivated} className="w-full" />
                <p className="mt-2 text-center text-xs text-ink-muted">
                  Débloque le trophée « Hausse compensée » de votre rétro
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* Défis : chaque levier rentable devient un défi, avec sa récompense et son trophée */}
        <motion.section
          variants={fadeUp}
          className="rounded-lg bg-surface p-4 shadow-card"
          aria-labelledby="challenges-title"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="challenges-title" className="font-semibold">
              Vos défis année 2
            </h2>
            <p className="text-sm text-ink-muted">
              <span className="font-semibold text-ink tabular-nums">
                {doneCount} / {challenges.length}
              </span>{' '}
              relevés
            </p>
          </div>
          <div aria-hidden className="mt-2 flex gap-1">
            {challenges.map((c) => (
              <span
                key={c.id}
                className={cx(
                  'h-1.5 flex-1 rounded-full transition-colors duration-300',
                  c.done ? 'bg-solar' : 'bg-gauge-track'
                )}
              />
            ))}
          </div>
          <ul className="mt-3 flex flex-col divide-y divide-line">
            {challenges.map((c) => (
              <ChallengeRow key={c.id} challenge={c} />
            ))}
          </ul>
          <p className="mt-2 rounded-md bg-hike-surface px-3 py-2 text-xs text-ink">
            <span className="font-semibold text-hike">Piège à éviter :</span> passer à 300 kWh coûte{' '}
            <span className="font-semibold text-hike">{eur(leverGain('capacity300'))}</span> / an,
            l’abonnement monte plus vite que ce que vous stockez.
          </p>
        </motion.section>

        <motion.div variants={fadeUp}>
          <WhyThis
            title="Comment on a calculé ?"
            hypotheses={[
              {
                label: 'Votre année 2026',
                value: '35 040 quarts d’heure, projetés sur votre profil',
              },
              { label: 'Hausse du 1er novembre', value: 'vos achats au réseau × écart de prix' },
              { label: 'Cagnotte MySmartPilot', value: '0,05 € par kWh de PAC et ballon pilotés' },
              {
                label: 'Batterie virtuelle',
                value: '20 kWh 14,99 € · 100 kWh 21,99 € · 300 kWh 35,99 € par mois',
              },
            ]}
            source={`Profil démo ${profile.prenom} · ${profile.ville}, données réelles de Claire Martin. Paliers et trophées : mécanique de démo.`}
          />
        </motion.div>
      </motion.main>

      {/* Barre d’action à portée de pouce : solde en rappel + activation de l’upgrade */}
      <motion.div
        className="fixed inset-x-0 bottom-0 border-t border-line bg-canvas px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3, ease: ease.out, delay: 0.4 }}
      >
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">
            Solde{' '}
            <motion.span
              key={Math.round(balance)}
              className={cx(
                'block origin-left text-lg font-semibold tabular-nums',
                balance >= 0 ? 'text-win' : 'text-hike'
              )}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 0.25, ease: ease.out }}
            >
              {eur(balance)} / an
            </motion.span>
          </p>
          {activated ? (
            <p className="inline-flex items-center gap-1 text-sm font-semibold text-win">
              <Check className="size-4" aria-hidden /> Compte piloté demandé
            </p>
          ) : (
            <ActivationForm onActivated={onActivated} />
          )}
        </div>
      </motion.div>

      <RobinHelp />
    </MotionConfig>
  )
}

/** Demande d’activation du compte piloté (POST simulé, tracé côté serveur). */
function ActivationForm({
  onActivated,
  className,
}: {
  onActivated: () => void
  className?: string
}) {
  return (
    <Form route="next_year.execute" options={{ preserveScroll: true }} onSuccess={onActivated}>
      {({ processing }) => (
        <ActionButton
          type="submit"
          className={cx('h-12 px-5 text-base', className)}
          state={processing ? 'loading' : 'idle'}
        >
          Activer gratuitement
        </ActionButton>
      )}
    </Form>
  )
}

type Challenge = {
  id: string
  title: string
  hint?: string
  reward: string
  trophy: string
  icon: ReactNode
  done: boolean
  onToggle: () => void
}

/**
 * Défi : vraie case à cocher (clavier, lecteur d’écran) ; cocher simule le levier et débloque son trophée.
 * Friction traitée : un interrupteur seul ne dit pas ce qu’on y gagne ; le défi montre la récompense avant.
 */
function ChallengeRow({ challenge: c }: { challenge: Challenge }) {
  return (
    <li>
      <label className="flex min-h-14 cursor-pointer items-center gap-3 py-3">
        <input type="checkbox" className="peer sr-only" checked={c.done} onChange={c.onToggle} />
        <motion.span
          aria-hidden
          animate={{ scale: c.done ? [1, 1.15, 1] : 1 }}
          transition={{ duration: 0.3 }}
          className={cx(
            'flex size-10 shrink-0 items-center justify-center rounded-full transition-colors',
            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary',
            c.done ? 'bg-solar text-ink' : 'bg-canvas text-ink-muted ring-1 ring-line'
          )}
        >
          {c.done ? <Check className="size-5" /> : c.icon}
        </motion.span>
        <span className="min-w-0 flex-1 text-sm">
          <span className="block font-medium">{c.title}</span>
          <span className="flex items-center gap-1 text-xs text-ink-muted">
            {c.done ? (
              <Trophy className="size-3 text-solar" aria-hidden />
            ) : (
              <Lock className="size-3" aria-hidden />
            )}
            {c.done ? `Trophée ${c.trophy}` : (c.hint ?? `Débloque ${c.trophy}`)}
          </span>
        </span>
        <span
          className={cx(
            'font-semibold whitespace-nowrap tabular-nums',
            c.reward.startsWith('+') ? 'text-win' : 'text-ink-muted'
          )}
        >
          {c.reward}
        </span>
      </label>
    </li>
  )
}

/**
 * Robin en bot discret, en bas à droite au-dessus de la barre d’action : il se présente une fois,
 * puis reste en pastille. Pas de réponse générée pendant la démo (libellé honnête).
 */
function RobinHelp() {
  const [open, setOpen] = useState(true)
  return (
    <div className="fixed right-4 bottom-24 z-10 flex flex-col items-end gap-2">
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="bubble"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { ...softSpring, delay: 1.2 } }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="relative max-w-56 rounded-lg rounded-br-sm bg-surface p-3 pr-8 text-sm shadow-card ring-1 ring-line"
          >
            <p className="font-semibold">Une question ?</p>
            <p className="text-ink-muted">Je suis Robin, je suis là pour vous aider.</p>
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => setOpen(false)}
              className="absolute top-1 right-1 flex size-8 items-center justify-center rounded-full text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        type="button"
        aria-label="Poser une question à Robin"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o)
          track('robin_ouvert', { page: 'annee_2' })
        }}
        whileTap={{ scale: 0.92 }}
        transition={spring}
        className="flex size-14 items-center justify-center rounded-full bg-surface shadow-card ring-2 ring-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <AssistantAvatar mood="happy" size={40} />
      </motion.button>
    </div>
  )
}
