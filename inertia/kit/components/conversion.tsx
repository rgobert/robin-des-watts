/*
 * Blocs de conversion : débloquer, upgrader, choisir une offre, suggérer au bon moment.
 * Règles (non négociables, la cible est une famille qui paie ses factures) :
 * - le prix TTC et la réversibilité sont toujours visibles à côté du CTA ;
 * - le gain est calculé sur LES données du foyer, avec « Pourquoi ce chiffre ? » si possible ;
 * - pas de faux compte à rebours, pas de case pré-cochée, pas de « Non merci, je préfère payer plus ».
 */
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRef, useState, type ReactNode } from 'react'
import { duration, ease, fadeUp, softSpring, spring, stagger } from '../motion'
import { cx } from '../utils'
import { ActionButton } from './action_button'
import { AnimatedNumber } from './animated_number'

/* ---------------- LockedFeature ---------------- */

type LockedProps = {
  title: string
  /** Ce que l'utilisateur gagnerait, chiffré sur ses données. Ex. « +148 € par an avec votre PAC ». */
  teaser: ReactNode
  ctaLabel?: string
  /** Prix + réversibilité, ex. « 3,90 €/mois · sans engagement ». */
  terms?: string
  /** Peut renvoyer une promesse (appel réel) : le cadenas s'ouvre quand elle se résout. */
  onUnlock?: () => void | Promise<void>
  /** Le contenu premium, visible flouté derrière le cadenas. */
  children: ReactNode
  className?: string
}

/**
 * Fonctionnalité verrouillée : on montre le contenu flouté (la valeur est réelle, pas promise),
 * le cadenas réagit au survol, et s'ouvre en direct au déblocage.
 */
export function LockedFeature({
  title,
  teaser,
  ctaLabel = 'Débloquer',
  terms,
  onUnlock,
  children,
  className,
}: LockedProps) {
  const reduce = useReducedMotion()
  const [state, setState] = useState<'locked' | 'loading' | 'open'>('locked')
  const [hover, setHover] = useState(false)

  const unlock = async () => {
    setState('loading')
    await Promise.all([onUnlock?.(), new Promise((r) => setTimeout(r, 700))])
    setState('open')
  }

  return (
    <div
      className={cx('relative overflow-hidden rounded-lg border border-line bg-surface', className)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <motion.div
        aria-hidden={state !== 'open'}
        initial={false}
        animate={{
          filter: state === 'open' || reduce ? 'blur(0px)' : 'blur(6px)',
          opacity: state === 'open' ? 1 : 0.55,
          scale: state === 'open' ? 1 : 1.02,
        }}
        transition={{ duration: duration.story, ease: ease.out }}
        className={cx('p-5', state !== 'open' && 'pointer-events-none select-none')}
      >
        {children}
      </motion.div>

      <AnimatePresence>
        {state !== 'open' && (
          <motion.div
            className="absolute inset-0 grid place-items-center bg-gradient-to-b from-surface/40 to-surface/90 p-5 text-center"
            exit={{ opacity: 0, transition: { duration: duration.slow, delay: 0.25 } }}
          >
            <div className="max-w-xs">
              <Padlock open={state === 'loading' || hover} unlocking={state === 'loading'} />
              <p className="mt-3 font-display text-lg text-ink">{title}</p>
              <p className="mt-1 text-sm text-ink">{teaser}</p>
              <ActionButton
                className="mt-4"
                state={state === 'loading' ? 'loading' : 'idle'}
                loadingLabel="Déblocage…"
                onClick={unlock}
              >
                {ctaLabel}
              </ActionButton>
              {terms && <p className="mt-2 text-xs text-ink-muted">{terms}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Padlock({ open, unlocking }: { open: boolean; unlocking: boolean }) {
  return (
    <svg viewBox="0 0 40 44" className="mx-auto size-10" aria-hidden>
      <motion.path
        d="M12 20 V13 a8 8 0 0 1 16 0 V20"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="3.2"
        strokeLinecap="round"
        animate={{ y: unlocking ? -7 : open ? -3 : 0, rotate: unlocking ? -14 : 0 }}
        style={{ originX: '28px', originY: '20px' }}
        transition={spring}
      />
      <rect x="7" y="19" width="26" height="21" rx="6" fill="var(--color-primary)" />
      <motion.circle
        cx="20"
        cy="29"
        r="2.6"
        fill="var(--color-accent)"
        animate={{ scale: unlocking ? [1, 1.4, 1] : 1 }}
        transition={{ duration: 0.5 }}
      />
    </svg>
  )
}

/* ---------------- UpgradeCard ---------------- */

type UpgradeProps = {
  badge?: string
  title: string
  /** Gain annuel actuel (€) et gain avec l'option (€), calculés sur le foyer. */
  current: { label: string; value: number }
  upgraded: { label: string; value: number }
  /** Prix lisible, ex. « 5 €/mois ». */
  price: string
  benefits: string[]
  reassurance?: string[]
  ctaLabel?: string
  successTitle?: string
  successText?: string
  onUpgrade?: () => void | Promise<void>
  className?: string
}

/**
 * Carte d'upgrade : avant / après sur les données du foyer, gain net animé, CTA avec états,
 * et une vraie confirmation (pas un simple toast) au succès.
 */
export function UpgradeCard({
  badge = 'Recommandé pour vous',
  title,
  current,
  upgraded,
  price,
  benefits,
  reassurance = ['Sans engagement', 'Activable et résiliable dans l’app'],
  ctaLabel = 'Passer à l’option',
  successTitle = 'C’est activé',
  successText = 'Vos premiers gains apparaîtront demain matin.',
  onUpgrade,
  className,
}: UpgradeProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'success'>('idle')
  const max = Math.max(current.value, upgraded.value)
  const delta = upgraded.value - current.value

  const go = async () => {
    setState('loading')
    await Promise.all([onUpgrade?.(), new Promise((r) => setTimeout(r, 900))])
    setState('success')
  }

  return (
    <motion.div
      layout
      className={cx(
        'overflow-hidden rounded-lg border border-line bg-surface p-5 shadow-card',
        className
      )}
      transition={softSpring}
    >
      <AnimatePresence mode="wait" initial={false}>
        {state !== 'success' ? (
          <motion.div
            key="offer"
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: duration.fast }}
          >
            <span className="inline-flex rounded-full bg-reward/12 px-2.5 py-1 text-xs font-semibold text-primary">
              {badge}
            </span>
            <p className="mt-3 font-display text-xl text-ink">{title}</p>

            <div className="mt-5 space-y-3">
              {[current, upgraded].map((row, k) => (
                <div key={row.label}>
                  <div className="flex justify-between text-sm">
                    <span className={k ? 'font-medium text-ink' : 'text-ink-muted'}>
                      {row.label}
                    </span>
                    <span
                      className={cx(
                        'tabular-nums',
                        k ? 'font-semibold text-ink' : 'text-ink-muted'
                      )}
                    >
                      <AnimatedNumber value={row.value} suffix=" €/an" />
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                    <motion.div
                      className={cx('h-full rounded-full', k ? 'bg-reward' : 'bg-ink-muted/40')}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(row.value / max) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, ease: ease.out, delay: k * 0.25 }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-sm text-ink">
              Soit{' '}
              <span className="font-semibold text-reward">
                <AnimatedNumber value={delta} prefix="+" suffix=" €" />
              </span>{' '}
              par an, pour {price}.
            </p>

            <motion.ul
              className="mt-4 space-y-2"
              variants={stagger(0.05)}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
            >
              {benefits.map((b) => (
                <motion.li key={b} variants={fadeUp} className="flex gap-2 text-sm text-ink">
                  <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-success">
                    <path
                      d="M3.5 8.5l3 3 6-7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {b}
                </motion.li>
              ))}
            </motion.ul>

            <ActionButton
              className="mt-5 w-full"
              state={state}
              loadingLabel="Activation…"
              onClick={go}
            >
              {ctaLabel} · {price}
            </ActionButton>
            <p className="mt-2 text-center text-xs text-ink-muted">{reassurance.join(' · ')}</p>
          </motion.div>
        ) : (
          <motion.div
            key="ok"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="py-6 text-center"
          >
            <motion.svg
              viewBox="0 0 48 48"
              className="mx-auto size-12 text-success"
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            >
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
                transition={{ duration: 0.45, delay: 0.1 }}
              />
            </motion.svg>
            <p className="mt-3 font-display text-xl text-ink">{successTitle}</p>
            <p className="mt-1 text-sm text-ink-muted">{successText}</p>
            <button
              onClick={() => setState('idle')}
              className="mt-4 text-sm font-medium text-primary"
            >
              Revenir en arrière
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ---------------- PlanPicker ---------------- */

export type Plan = {
  id: string
  name: string
  price: string
  unit?: string
  highlights: string[]
  /** Si présent : plan recommandé, avec la raison tirée des données du foyer. */
  recommendedReason?: string
}

/**
 * Choix d'offre : la sélection glisse d'une carte à l'autre, le plan recommandé dit POURQUOI (données du foyer).
 * Radio group accessible (flèches du clavier).
 */
export function PlanPicker({
  plans,
  value,
  onChange,
  label = 'Choisir une offre',
  note,
  className,
}: {
  plans: Plan[]
  value: string
  onChange: (id: string) => void
  /** Nom accessible du groupe. */
  label?: string
  /** Prix TTC + réversibilité, affiché sous les offres (E-PRICE). Ex. « Prix TTC · sans engagement ». */
  note?: ReactNode
  className?: string
}) {
  const idx = plans.findIndex((p) => p.id === value)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const move = (dir: 1 | -1) => {
    const n = (idx + dir + plans.length) % plans.length
    onChange(plans[n].id)
    refs.current[n]?.focus()
  }
  return (
    <div className={className}>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid gap-3 sm:grid-cols-3"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault()
            move(1)
          }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault()
            move(-1)
          }
        }}
      >
        {plans.map((p) => {
          const on = p.id === value
          return (
            <motion.button
              key={p.id}
              ref={(n) => {
                refs.current[plans.indexOf(p)] = n
              }}
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              whileTap={{ scale: 0.98 }}
              onClick={() => onChange(p.id)}
              className="relative rounded-lg border border-line bg-surface p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {on && (
                <motion.span
                  layoutId="plan-ring"
                  className="absolute inset-0 rounded-lg border-2 border-primary"
                  transition={spring}
                />
              )}
              {p.recommendedReason && (
                <span className="mb-2 inline-flex rounded-full bg-reward/12 px-2 py-0.5 text-xs font-semibold text-primary">
                  Recommandé pour vous
                </span>
              )}
              <p className="font-display text-lg text-ink">{p.name}</p>
              <p className="mt-1 text-ink">
                <span className="text-2xl font-semibold tabular-nums">{p.price}</span>
                {p.unit && <span className="text-sm text-ink-muted"> {p.unit}</span>}
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-ink-muted">
                {p.highlights.map((h) => (
                  <li key={h}>· {h}</li>
                ))}
              </ul>
              <AnimatePresence>
                {on && p.recommendedReason && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden text-xs text-reward"
                  >
                    <span className="mt-3 block">{p.recommendedReason}</span>
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.button>
          )
        })}
      </div>
      {note && <p className="mt-3 text-xs text-ink-muted">{note}</p>}
    </div>
  )
}

/* ---------------- NudgeBanner ---------------- */

/**
 * Suggestion contextuelle, au moment où elle a du sens (après un résultat, pas à l'arrivée).
 * Fermable, et ne revient pas tant que la page n'est pas rechargée.
 */
export function NudgeBanner({
  title,
  text,
  ctaLabel,
  onCta,
  icon,
  className,
}: {
  title: string
  text: string
  ctaLabel: string
  onCta?: () => void
  icon?: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(true)
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: duration.base, ease: ease.out }}
          className="overflow-hidden"
        >
          <div
            className={cx(
              'flex items-start gap-3 rounded-md border border-reward/30 bg-reward/8 p-4',
              className
            )}
          >
            {icon ?? (
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-reward text-primary-contrast">
                <svg
                  viewBox="0 0 16 16"
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M8 3v10M3 8h10" />
                </svg>
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{title}</p>
              <p className="mt-0.5 text-sm text-ink/80">{text}</p>
              <button
                onClick={onCta}
                className="mt-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              >
                {ctaLabel} →
              </button>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Masquer la suggestion"
              className="-m-1.5 grid size-8 shrink-0 place-items-center rounded-full text-ink/70 hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
            >
              <svg viewBox="0 0 12 12" className="size-3">
                <path
                  d="M2 2l8 8M10 2l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
