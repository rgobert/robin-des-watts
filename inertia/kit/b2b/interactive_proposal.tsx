import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'motion/react'
import { useId, useRef, useState, type ReactNode } from 'react'
import { ActionButton } from '../components/action_button'
import { AnimatedNumber } from '../components/animated_number'
import { duration, ease, fadeUp, spring, stagger } from '../motion'
import { cx } from '../utils'
import { focusRing, initials } from './shared'
import { useToast } from '../components/toast'

export type ProposalOption = {
  id: string
  name: string
  tagline: string
  /** Mensualité TTC (€). */
  monthly: number
  monthlyNote?: string
  /** Économie estimée (€ / an). */
  savingsYear: number
  /** Part de la consommation couverte par le solaire (%). */
  solarShare: number
  /** Cagnotte estimée (€ / an). */
  rewardYear: number
  highlights: string[]
  recommendedReason?: string
}

export type ProposalSection = { id: string; title: string; content: ReactNode }

/**
 * Proposition commerciale web, envoyée par l'installateur au client : message d'accueil, 4 chiffres vedettes
 * (économie/an, part solaire, cagnotte, mensualité), bascule entre offres qui anime les chiffres, sections qui entrent
 * au défilement avec barre de progression, CTA « Accepter la proposition » et « Poser une question » (réponse inline).
 * Pattern : P18 (OpenSolar, Aurora Sales Mode), benchmark-concurrentiel_suivi-conso.md.
 * Friction traitée : le PDF de devis qu'on ne relit pas ; le client manipule lui-même l'offre et la partage au foyer.
 */
export function InteractiveProposal({
  clientFirstName,
  installer,
  message,
  options,
  defaultOptionId,
  sections = [],
  validity = 'Proposition valable 30 jours · sans engagement de durée',
  onAccept,
  onAsk,
  className,
}: {
  clientFirstName: string
  installer: { company: string; person: string; role?: string }
  message: string
  options: ProposalOption[]
  defaultOptionId?: string
  sections?: ProposalSection[]
  validity?: string
  onAccept?: (option: ProposalOption) => void | Promise<void>
  onAsk?: (question: string, option: ProposalOption) => void | Promise<void>
  className?: string
}) {
  const reduce = useReducedMotion()
  const [optId, setOptId] = useState(defaultOptionId ?? options[0]?.id)
  const opt = options.find((o) => o.id === optId) ?? options[0]
  const [accept, setAccept] = useState<'idle' | 'loading' | 'success'>('idle')
  const toast = useToast()
  const [asking, setAsking] = useState(false)
  const [question, setQuestion] = useState('')
  const [asked, setAsked] = useState<'idle' | 'loading' | 'success'>('idle')
  const ref = useRef<HTMLDivElement>(null)
  const qId = useId()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.6'] })
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30 })

  // Annonce lecteur d'écran dédiée : une phrase au changement d'offre (les KPI animés ne sont pas live).
  const [announce, setAnnounce] = useState('')
  const choose = (id: string) => {
    if (id === optId) return
    setOptId(id)
    const o = options.find((x) => x.id === id)
    if (o) setAnnounce(announceOffer(o))
  }

  const idx = options.findIndex((o) => o.id === opt.id)
  const pick = (i: number, group: HTMLElement) => {
    const n = (i + options.length) % options.length
    choose(options[n].id)
    requestAnimationFrame(() => group.querySelectorAll<HTMLElement>('[role="radio"]')[n]?.focus())
  }

  const kpis = [
    {
      label: 'Économie estimée',
      value: opt.savingsYear,
      suffix: ' €',
      note: 'par an',
      tone: 'text-reward',
    },
    {
      label: 'Part solaire',
      value: opt.solarShare,
      suffix: ' %',
      note: 'de votre consommation',
      tone: 'text-ink',
    },
    {
      label: 'Cagnotte estimée',
      value: opt.rewardYear,
      suffix: ' €',
      note: 'par an avec Robin',
      tone: 'text-reward',
    },
    {
      label: 'Mensualité',
      value: opt.monthly,
      suffix: ' €',
      note: opt.monthlyNote ?? 'par mois TTC',
      tone: 'text-ink',
      decimals: 2,
    },
  ]

  return (
    <div
      ref={ref}
      className={cx('relative overflow-clip rounded-lg border border-line bg-canvas', className)}
    >
      <motion.div
        aria-hidden
        className="absolute inset-x-0 top-0 z-[2] h-0.5 origin-left bg-primary"
        style={{ scaleX: reduce ? 1 : progress }}
      />

      {/* Accueil */}
      <motion.header
        variants={stagger(0.07)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="px-5 pt-7 pb-5 sm:px-8"
      >
        <motion.div variants={fadeUp} className="flex items-center gap-3">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-contrast"
            aria-hidden
          >
            {initials(installer.person)}
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-ink">{installer.person}</p>
            <p className="text-ink-muted">
              {installer.role ? `${installer.role} · ` : ''}
              {installer.company}
            </p>
          </div>
        </motion.div>
        <motion.h4
          variants={fadeUp}
          className="mt-5 font-display text-2xl tracking-[-0.02em] text-ink sm:text-3xl"
        >
          Bonjour {clientFirstName}, voici votre projet
        </motion.h4>
        <motion.p variants={fadeUp} className="mt-2 max-w-2xl text-ink-muted">
          {message}
        </motion.p>
      </motion.header>

      {/* Bascule d'offre, collée en haut au défilement */}
      <div className="sticky top-14 z-[1] border-y border-line bg-canvas/90 px-5 py-2.5 backdrop-blur-md sm:px-8">
        <div
          role="radiogroup"
          aria-label="Choisir une offre"
          className="grid gap-1 rounded-[20px] bg-surface-2 p-1"
          style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              e.preventDefault()
              pick(idx + 1, e.currentTarget)
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              e.preventDefault()
              pick(idx - 1, e.currentTarget)
            }
          }}
        >
          {options.map((o) => {
            const on = o.id === opt.id
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => choose(o.id)}
                className={cx(
                  'relative min-h-9 rounded-full px-2 py-1.5 text-center text-xs leading-tight font-semibold transition-colors sm:text-sm',
                  on ? 'text-primary-contrast' : 'text-ink-muted hover:text-ink',
                  focusRing
                )}
              >
                {on && (
                  <motion.span
                    layoutId="proposal-pill"
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={spring}
                  />
                )}
                <span className="relative">{o.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 4 chiffres vedettes */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </p>
      <section className="px-5 py-6 sm:px-8" aria-label="Chiffres clés de l’offre">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-md border border-line bg-surface p-4 shadow-card">
              <p className="text-xs text-ink-muted">{k.label}</p>
              <p className={cx('mt-1 font-display text-2xl font-semibold sm:text-3xl', k.tone)}>
                <AnimatedNumber
                  value={k.value}
                  suffix={k.suffix}
                  decimals={k.decimals ?? 0}
                  duration={0.6}
                />
              </p>
              <p className="text-xs text-ink-muted">{k.note}</p>
            </div>
          ))}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={opt.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: duration.fast, ease: ease.out }}
            className="mt-4"
          >
            <p className="text-sm text-ink">
              <span className="font-semibold">{opt.name}</span> · {opt.tagline}
            </p>
            {opt.recommendedReason && (
              <p className="mt-1.5 inline-flex rounded-md bg-reward/10 px-2.5 py-1 text-sm text-reward">
                <span className="font-semibold">Recommandé pour vous :&nbsp;</span>
                {opt.recommendedReason}
              </p>
            )}
            <ul className="mt-3 grid gap-1.5 text-sm text-ink-muted sm:grid-cols-2">
              {opt.highlights.map((h) => (
                <li key={h} className="flex gap-2">
                  <svg
                    viewBox="0 0 16 16"
                    className="mt-0.5 size-4 shrink-0 text-success"
                    aria-hidden
                  >
                    <path
                      d="M3.5 8.5l3 3 6-7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {h}
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
      </section>

      {/* Sections qui entrent au défilement */}
      {sections.map((s, i) => (
        <motion.section
          key={s.id}
          initial={{ opacity: 0, y: reduce ? 0 : 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: duration.slow, ease: ease.out }}
          className="border-t border-line px-5 py-6 sm:px-8"
        >
          <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
            {String(i + 1).padStart(2, '0')} · {s.title}
          </p>
          <div className="mt-3 text-sm text-ink">{s.content}</div>
        </motion.section>
      ))}

      {/* Décision */}
      <section className="border-t border-line bg-surface px-5 py-6 sm:px-8">
        <AnimatePresence mode="wait" initial={false}>
          {accept === 'success' ? (
            <motion.div
              key="ok"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring}
              className="text-center"
            >
              <svg viewBox="0 0 48 48" className="mx-auto size-12 text-success" aria-hidden>
                <circle cx="24" cy="24" r="22" fill="currentColor" opacity="0.14" />
                <motion.path
                  d="M15 25l6 6 12-14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.45 }}
                />
              </svg>
              <p className="mt-3 font-display text-xl text-ink">
                Proposition acceptée : {opt.name}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {installer.person} vous appelle sous 48 h pour fixer la date de pose. Vous recevez
                une copie par e-mail.
              </p>
              <button
                type="button"
                onClick={() => setAccept('idle')}
                className={cx(
                  'mt-3 rounded-sm text-sm font-medium text-primary hover:underline',
                  focusRing
                )}
              >
                Revoir les détails
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="cta"
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: duration.fast }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">
                    {opt.name} · {opt.monthly.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}{' '}
                    €/mois TTC
                  </p>
                  <p className="text-xs text-ink-muted">{validity}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    variant="secondary"
                    aria-expanded={asking}
                    aria-controls={qId}
                    onClick={() => setAsking((a) => !a)}
                  >
                    Poser une question
                  </ActionButton>
                  <ActionButton
                    state={accept}
                    loadingLabel="Validation…"
                    onClick={async () => {
                      setAccept('loading')
                      try {
                        await Promise.all([onAccept?.(opt), new Promise((r) => setTimeout(r, 900))])
                        setAccept('success')
                      } catch {
                        setAccept('idle')
                        toast({
                          message:
                            'Votre acceptation n’a pas pu être enregistrée. Réessayez dans un instant.',
                        })
                      }
                    }}
                  >
                    Accepter la proposition
                  </ActionButton>
                </div>
              </div>
              <AnimatePresence initial={false}>
                {asking && (
                  <motion.div
                    id={qId}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: duration.base, ease: ease.out }}
                    className="overflow-hidden"
                  >
                    {asked === 'success' ? (
                      <p className="mt-4 rounded-md bg-success/[0.08] px-3 py-2 text-sm text-ink">
                        Question envoyée à {installer.person}. Réponse sous 24 h, par e-mail ou par
                        téléphone.{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setAsked('idle')
                            setQuestion('')
                          }}
                          className={cx(
                            'rounded-sm font-medium text-primary hover:underline',
                            focusRing
                          )}
                        >
                          Poser une autre question
                        </button>
                      </p>
                    ) : (
                      <form
                        className="mt-4 flex flex-col gap-2 sm:flex-row"
                        onSubmit={async (e) => {
                          e.preventDefault()
                          if (!question.trim()) return
                          setAsked('loading')
                          await Promise.all([
                            onAsk?.(question.trim(), opt),
                            new Promise((r) => setTimeout(r, 700)),
                          ])
                          setAsked('success')
                        }}
                      >
                        <label className="sr-only" htmlFor={`${qId}-q`}>
                          Votre question
                        </label>
                        <input
                          id={`${qId}-q`}
                          autoFocus
                          value={question}
                          onChange={(e) => setQuestion(e.target.value)}
                          placeholder="Ex. Que se passe-t-il si je déménage ?"
                          className="h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-sm text-ink placeholder:text-ink-muted/80 focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none"
                        />
                        <ActionButton
                          type="submit"
                          variant="secondary"
                          state={asked === 'loading' ? 'loading' : 'idle'}
                          loadingLabel="Envoi…"
                          disabled={!question.trim()}
                        >
                          Envoyer
                        </ActionButton>
                      </form>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  )
}

/** « Offre ENCORE : 29,90 € TTC par mois, environ 1 300 € d'économies par an » */
function announceOffer(o: ProposalOption) {
  const step = o.savingsYear >= 1000 ? 100 : 10
  const savings = (Math.round(o.savingsYear / step) * step).toLocaleString('fr-FR')
  const monthly = o.monthly.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `Offre ${o.name} : ${monthly} € TTC par mois, environ ${savings} € d’économies par an`
}
