import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'
import { ActionButton } from '../../components/action_button'
import { AnimatedNumber } from '../../components/animated_number'
import { Term, WhyThis } from '../../components/explain'
import { useToast } from '../../components/toast'
import { duration, ease } from '../../motion'
import { cx } from '../../utils'
import { fmtEur, fmtNum } from './shared'

export type OnboardingAnswers = {
  kwc: number
  occupants: '1-2' | '3-4' | '5+'
  equipment: { water: boolean; heatPump: boolean; ev: boolean }
}

export type OnboardingEstimate = {
  production: number
  pilotedKwh: number
  savings: number
  cagnotte: number
  total: number
}

/** Hypothèses de calcul (surchargeables). */
export type OnboardingAssumptions = {
  /** Production annuelle par kWc installé (Lyon ≈ 1 150 kWh/kWc). */
  yieldPerKwc: number
  /** Part de la production disponible en surplus. */
  surplusShare: number
  /** Part du surplus que Robin parvient à placer dans les équipements. */
  captureRate: number
  gridPrice: number
  cagnottePerKwh: number
  /** Besoin annuel absorbable par équipement (kWh). */
  needs: { water: Record<OnboardingAnswers['occupants'], number>; heatPump: number; ev: number }
}

export const DEFAULT_ONBOARDING_ASSUMPTIONS: OnboardingAssumptions = {
  yieldPerKwc: 1150,
  surplusShare: 0.45,
  captureRate: 0.6,
  gridPrice: 0.194,
  cagnottePerKwh: 0.05,
  needs: { water: { '1-2': 600, '3-4': 900, '5+': 1200 }, heatPump: 1200, ev: 1500 },
}

/** Gain annuel estimé à partir des réponses : surplus capté × (prix réseau évité + barème cagnotte). */
export function estimateSmartGain(
  a: OnboardingAnswers,
  h: OnboardingAssumptions = DEFAULT_ONBOARDING_ASSUMPTIONS
): OnboardingEstimate {
  const production = a.kwc * h.yieldPerKwc
  const need =
    (a.equipment.water ? h.needs.water[a.occupants] : 0) +
    (a.equipment.heatPump ? h.needs.heatPump : 0) +
    (a.equipment.ev ? h.needs.ev : 0)
  const pilotedKwh = Math.min(need, production * h.surplusShare) * h.captureRate
  const savings = pilotedKwh * h.gridPrice
  const cagnotte = pilotedKwh * h.cagnottePerKwh
  return { production, pilotedKwh, savings, cagnotte, total: savings + cagnotte }
}

export const DEMO_ONBOARDING_ANSWERS: OnboardingAnswers = {
  kwc: 6,
  occupants: '3-4',
  equipment: { water: true, heatPump: true, ev: true },
}

type Labels = {
  steps: [string, string, string]
  demo: string
  demoBanner: string
  start: string
  consent: string
  consentDetail: string
  activate: string
}
const DEFAULT_LABELS: Labels = {
  steps: ['Votre maison', 'Vos équipements pilotables', 'Votre premier gain estimé'],
  demo: 'Voir la démo d’abord',
  demoBanner:
    'Mode démo : données de la famille Martin (6 kWc, Villeurbanne). Rien n’est enregistré.',
  start: 'Commencer avec mes données',
  consent:
    'J’autorise mylight150 à lire ma courbe de consommation Linky (pas de 30 min) pour piloter mes équipements.',
  consentDetail:
    'Révocable à tout moment dans Réglages › Mes données. Jamais revendu, jamais partagé sans votre accord.',
  activate: 'Activer le mode Smart',
}

const EQUIPMENT: { id: keyof OnboardingAnswers['equipment']; label: string; hint: string }[] = [
  {
    id: 'water',
    label: 'Chauffe-eau électrique',
    hint: 'Le plus simple : Robin le chauffe quand le soleil brille.',
  },
  {
    id: 'heatPump',
    label: 'Pompe à chaleur',
    hint: 'Préchauffage solaire, pause pendant les pointes. Confort garanti.',
  },
  {
    id: 'ev',
    label: 'Voiture électrique (borne)',
    hint: 'Charge modulée sur votre surplus, prête à l’heure dite.',
  },
]

/**
 * Onboarding du mode Smart en 3 écrans (« Votre maison », « Vos équipements pilotables », « Votre premier
 * gain estimé »), avec barre de progression, option « Voir la démo d'abord », gain final animé et calculé
 * sur les réponses (hypothèses dépliables), consentement explicite (case non pré-cochée) et révocable.
 * Friction traitée : on demande des efforts (PDL, compteur, équipements) avant de montrer la moindre
 * valeur ; et l'accès aux données Linky sans explication fait fuir.
 * Pattern : P17 (Hello Watt, mode démo mylight150).
 */
export function SmartOnboarding({
  initial = { kwc: 6, occupants: '3-4', equipment: { water: true, heatPump: false, ev: false } },
  assumptions = DEFAULT_ONBOARDING_ASSUMPTIONS,
  onComplete,
  onConsentChange,
  labels: labelsProp,
  className,
}: {
  initial?: OnboardingAnswers
  assumptions?: OnboardingAssumptions
  onComplete?: (answers: OnboardingAnswers, estimate: OnboardingEstimate) => void | Promise<void>
  onConsentChange?: (granted: boolean) => void
  labels?: Partial<Labels>
  className?: string
}) {
  const L = { ...DEFAULT_LABELS, ...labelsProp }
  const toast = useToast()
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<OnboardingAnswers>(initial)
  const [demo, setDemo] = useState(false)
  const [consent, setConsent] = useState(false)
  const [btn, setBtn] = useState<'idle' | 'loading' | 'success'>('idle')
  const [done, setDone] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const kwcId = useId()
  const consentId = useId()
  const firstRender = useRef(true)

  const data = demo ? DEMO_ONBOARDING_ANSWERS : answers
  const est = estimateSmartGain(data, assumptions)
  const anyEquipment = Object.values(answers.equipment).some(Boolean)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
  }, [step, demo, done])

  const go = (s: number) => setStep(Math.max(0, Math.min(2, s)))
  const startDemo = () => {
    setDemo(true)
    setStep(2)
  }
  const leaveDemo = () => {
    setDemo(false)
    setStep(0)
  }
  const setConsentAndNotify = (v: boolean) => {
    setConsent(v)
    onConsentChange?.(v)
  }
  const activate = async () => {
    setBtn('loading')
    await Promise.all([onComplete?.(answers, est), new Promise((r) => setTimeout(r, 1000))])
    setBtn('success')
    setTimeout(() => setDone(true), 600)
  }
  const revoke = () => {
    setConsentAndNotify(false)
    toast({
      message:
        'Consentement révoqué : Robin ne lit plus votre courbe Linky et met le pilotage en pause.',
      actionLabel: 'Annuler',
      onAction: () => setConsentAndNotify(true),
    })
  }

  const title = done ? 'Robin est prêt' : L.steps[step]
  const progress = done ? 1 : (step + 1) / 3

  return (
    <div
      className={cx(
        'overflow-hidden rounded-lg border border-line bg-surface shadow-card',
        className
      )}
    >
      {/* progression */}
      <div
        className="h-1 bg-surface-2"
        role="progressbar"
        aria-label="Progression de l’inscription"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={done ? 3 : step + 1}
      >
        <motion.div
          className="h-full bg-primary"
          initial={false}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: duration.slow, ease: ease.out }}
        />
      </div>
      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-ink-muted">
            {done ? 'Terminé' : demo ? 'Démo' : `Étape ${step + 1} sur 3`}
          </p>
          {!demo && !done && step < 2 && (
            <button
              type="button"
              onClick={startDemo}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {L.demo}
            </button>
          )}
        </div>
        <h4
          ref={headingRef}
          tabIndex={-1}
          className="mt-1 font-display text-xl font-semibold tracking-[-0.01em] text-ink outline-none"
        >
          {title}
        </h4>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={done ? 'done' : `${step}-${demo}`}
            initial={{ opacity: 0, x: reduce ? 0 : 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduce ? 0 : -16 }}
            transition={{ duration: duration.base, ease: ease.out }}
            className="mt-4"
          >
            {done ? (
              <div>
                <p className="text-sm text-ink">
                  Le mode Smart est actif. Premier pilotage dès demain midi si le soleil est au
                  rendez-vous ; vous verrez chaque action de Robin, avec son pourquoi.
                </p>
                <div className="mt-4 flex items-start justify-between gap-3 rounded-md bg-surface-2 px-3 py-2.5 text-sm">
                  <span className="text-ink">
                    Accès aux données Linky : <strong>{consent ? 'autorisé' : 'révoqué'}</strong>
                  </span>
                  {consent ? (
                    <button
                      type="button"
                      onClick={revoke}
                      className="shrink-0 font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      Révoquer
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConsentAndNotify(true)}
                      className="shrink-0 font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      Réautoriser
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDone(false)
                    setBtn('idle')
                    setStep(0)
                  }}
                  className="mt-3 text-sm font-medium text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
                >
                  Recommencer le parcours
                </button>
              </div>
            ) : step === 0 ? (
              <div className="grid gap-5">
                <div>
                  <label
                    htmlFor={kwcId}
                    className="flex items-baseline justify-between text-sm text-ink"
                  >
                    <span>
                      Puissance de vos panneaux (
                      <Term def="Kilowatt-crête : la puissance maximale de vos panneaux en plein soleil. Elle figure sur votre facture d’installation.">
                        kWc
                      </Term>
                      )
                    </span>
                    <strong className="font-display text-lg tabular-nums">
                      {fmtNum(answers.kwc, 1).replace(',0', '')} kWc
                    </strong>
                  </label>
                  <input
                    id={kwcId}
                    type="range"
                    min={3}
                    max={12}
                    step={0.5}
                    value={answers.kwc}
                    onChange={(e) => setAnswers((a) => ({ ...a, kwc: Number(e.target.value) }))}
                    className="mt-2 w-full accent-primary"
                  />
                  <p className="mt-1 text-xs text-ink-muted">
                    ≈ {fmtNum(answers.kwc * assumptions.yieldPerKwc)} kWh produits par an près de
                    Lyon.
                  </p>
                </div>
                <fieldset>
                  <legend className="text-sm text-ink">Combien vivez-vous à la maison ?</legend>
                  <div className="mt-2 flex gap-2">
                    {(['1-2', '3-4', '5+'] as const).map((o) => (
                      <button
                        key={o}
                        type="button"
                        aria-pressed={answers.occupants === o}
                        onClick={() => setAnswers((a) => ({ ...a, occupants: o }))}
                        className={cx(
                          'h-10 flex-1 rounded-full border text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                          answers.occupants === o
                            ? 'border-primary bg-primary text-primary-contrast'
                            : 'border-line bg-surface text-ink hover:border-ink/30'
                        )}
                      >
                        {o} pers.
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
            ) : step === 1 ? (
              <fieldset>
                <legend className="text-sm text-ink-muted">
                  Cochez ce que Robin peut piloter. Vous pourrez en ajouter plus tard.
                </legend>
                <div className="mt-3 grid gap-2">
                  {EQUIPMENT.map((eq) => {
                    const on = answers.equipment[eq.id]
                    return (
                      <label
                        key={eq.id}
                        className={cx(
                          'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary',
                          on ? 'border-primary/60 bg-surface-2' : 'border-line hover:border-ink/30'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) =>
                            setAnswers((a) => ({
                              ...a,
                              equipment: { ...a.equipment, [eq.id]: e.target.checked },
                            }))
                          }
                          className="mt-0.5 size-4 accent-primary"
                        />
                        <span>
                          <span className="block text-sm font-medium text-ink">{eq.label}</span>
                          <span className="block text-xs text-ink-muted">{eq.hint}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                {!anyEquipment && (
                  <p className="mt-2 text-xs text-ink-muted">
                    Sans équipement piloté, Robin vous conseille seulement : le gain sera faible.
                  </p>
                )}
              </fieldset>
            ) : (
              <div>
                {demo && (
                  <p className="mb-4 rounded-md bg-surface-2 px-3 py-2 text-xs text-ink">
                    {L.demoBanner}
                  </p>
                )}
                <p className="text-sm text-ink-muted">Avec le mode Smart, chaque année :</p>
                <p className="mt-1 font-display text-5xl font-semibold tracking-[-0.02em] text-ink">
                  <AnimatedNumber
                    key={`${demo}`}
                    value={Math.round(est.total)}
                    prefix="≈ "
                    suffix=" €"
                    duration={1.2}
                  />
                </p>
                <p className="mt-2 text-sm text-ink">
                  dont <strong>{fmtEur(est.savings, 0)}</strong> d’électricité en moins sur la
                  facture et <strong>{fmtEur(est.cagnotte, 0)}</strong> dans votre cagnotte.
                </p>
                <WhyThis
                  className="mt-3"
                  hypotheses={[
                    { label: 'Production estimée', value: `${fmtNum(est.production)} kWh/an` },
                    {
                      label: 'Surplus disponible',
                      value: `${fmtNum(assumptions.surplusShare * 100)} %`,
                    },
                    { label: 'kWh placés par Robin', value: `${fmtNum(est.pilotedKwh)} kWh/an` },
                    {
                      label: 'Prix réseau évité',
                      value: `${fmtEur(assumptions.gridPrice, 3)}/kWh`,
                    },
                    {
                      label: 'Barème cagnotte',
                      value: `${fmtNum(assumptions.cagnottePerKwh * 100)} cts/kWh`,
                    },
                  ]}
                  source="Estimation prudente, recalculée sur vos vraies données après 30 jours."
                />
                {demo ? (
                  <ActionButton className="mt-5 w-full sm:w-auto" onClick={leaveDemo}>
                    {L.start}
                  </ActionButton>
                ) : (
                  <div className="mt-5">
                    <label
                      htmlFor={consentId}
                      className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
                    >
                      <input
                        id={consentId}
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsentAndNotify(e.target.checked)}
                        className="mt-0.5 size-4 shrink-0 accent-primary"
                      />
                      <span>
                        <span className="block text-sm text-ink">{L.consent}</span>
                        <span className="mt-0.5 block text-xs text-ink-muted">
                          {L.consentDetail}
                        </span>
                      </span>
                    </label>
                    <ActionButton
                      className="mt-4 w-full sm:w-auto"
                      state={btn}
                      disabled={!consent}
                      loadingLabel="Activation…"
                      successLabel="Activé"
                      onClick={activate}
                    >
                      {L.activate}
                    </ActionButton>
                    {!consent && (
                      <p className="mt-2 text-xs text-ink-muted">
                        Cochez l’autorisation pour activer. Le gain ci-dessus reste visible sans.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {!done && !demo && (
          <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
            <button
              type="button"
              onClick={() => go(step - 1)}
              disabled={step === 0}
              className="text-sm font-medium text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary disabled:invisible"
            >
              Retour
            </button>
            {step < 2 && (
              <ActionButton onClick={() => go(step + 1)} className="h-10">
                {step === 0 ? 'Suivant : mes équipements' : 'Voir mon gain'}
              </ActionButton>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
