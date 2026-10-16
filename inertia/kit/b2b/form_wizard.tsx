import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ActionButton } from '../components/action_button'
import { duration, ease, spring } from '../motion'
import { cx } from '../utils'
import { focusRing } from './shared'
import { useToast } from '../components/toast'

export type WizardValues = Record<string, string | string[]>

export type WizardField<V extends WizardValues> = {
  name: keyof V & string
  label: string
  type?: 'text' | 'email' | 'tel' | 'number' | 'select' | 'radio' | 'checkboxes'
  options?: { value: string; label: string; hint?: string; badge?: string }[]
  placeholder?: string
  /** Unité affichée dans le champ : « kWc », « kVA ». */
  suffix?: string
  hint?: string
  required?: boolean
  /** Renvoie un message d'erreur, ou null si c'est bon. */
  validate?: (value: V[keyof V], values: V) => string | null
  /** Occupe une demi-largeur sur desktop. */
  half?: boolean
  autoComplete?: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email'
}

export type WizardStep<V extends WizardValues> = {
  id: string
  title: string
  description?: string
  fields: WizardField<V>[]
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

type Labels = {
  next: string
  back: string
  review: string
  summary: string
  submit: string
  submitting: string
  submitted: string
  edit: string
  required: string
  saving: string
  saved: (ago: string) => string
  saveError: string
  stepOf: (i: number, n: number) => string
}

const DEFAULT_LABELS: Labels = {
  next: 'Continuer',
  back: 'Retour',
  review: 'Voir le récapitulatif',
  summary: 'Récapitulatif',
  submit: 'Créer le dossier',
  submitting: 'Création…',
  submitted: 'Dossier créé',
  edit: 'Modifier',
  required: 'Champ requis',
  saving: 'Enregistrement…',
  saved: (ago) => `Enregistré ${ago}`,
  saveError: 'Enregistrement impossible · vos saisies restent affichées',
  stepOf: (i, n) => `Étape ${i} sur ${n}`,
}

const agoLabel = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 5) return 'à l’instant'
  if (s < 60) return `il y a ${s} s`
  return `il y a ${Math.round(s / 60)} min`
}

/**
 * Formulaire multi-étapes : progression cliquable, validation inline (au blur puis en direct), autosave avec indicateur
 * (« Enregistré il y a 2 s »), Entrée pour avancer, récapitulatif final avec « Modifier » par section.
 * Friction traitée : le formulaire de 40 champs perdu au premier appel client ; ici on avance par blocs et rien ne se perd.
 */
export function FormWizard<V extends WizardValues>({
  steps,
  initialValues,
  onAutosave,
  autosaveDelay = 700,
  onSubmit,
  renderSummary,
  successContent,
  labels: labelsProp,
  className,
}: {
  steps: WizardStep<V>[]
  initialValues: V
  /** Appelé (débouncé) à chaque modification. Si la promesse échoue, l'indicateur le dit. */
  onAutosave?: (values: V) => void | Promise<void>
  autosaveDelay?: number
  onSubmit: (values: V) => void | Promise<void>
  /** Récapitulatif personnalisé. Par défaut : la liste des réponses, par étape. */
  renderSummary?: (values: V, goTo: (stepIndex: number) => void) => ReactNode
  /** Contenu après envoi ; reçoit une fonction pour recommencer. */
  successContent?: (values: V, reset: () => void) => ReactNode
  labels?: Partial<Labels>
  className?: string
}) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp }
  const reduce = useReducedMotion()
  const uid = useId()
  const [values, setValues] = useState<V>(initialValues)
  const [stepIdx, setStepIdx] = useState(0)
  const [dir, setDir] = useState(1)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [visited, setVisited] = useState(0)
  const [save, setSave] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [submit, setSubmit] = useState<'idle' | 'loading' | 'success'>('idle')
  const toast = useToast()
  const [dirty, setDirty] = useState(false)
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({})
  const headingRef = useRef<HTMLHeadingElement>(null)

  const total = steps.length
  const onSummary = stepIdx >= total
  const step = steps[Math.min(stepIdx, total - 1)]

  // Autosave débouncé.
  const autosaveRef = useRef(onAutosave)
  useLayoutEffect(() => {
    autosaveRef.current = onAutosave
  })
  useEffect(() => {
    if (!dirty || !autosaveRef.current) return
    const t = setTimeout(async () => {
      try {
        await autosaveRef.current?.(values)
        const at = Date.now()
        setSave('saved')
        setSavedAt(at)
        setNow(at)
      } catch {
        setSave('error')
      }
    }, autosaveDelay)
    return () => clearTimeout(t)
  }, [values, autosaveDelay, dirty])

  // Horloge de l'indicateur « il y a X s ».
  useEffect(() => {
    if (save !== 'saved') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [save])

  // Le titre d'étape reçoit le focus à chaque changement (lecteurs d'écran, clavier).
  const [focusPending, setFocusPending] = useState(false)

  const errorOf = (f: WizardField<V>, vals: V = values): string | null => {
    const v = vals[f.name]
    const empty = Array.isArray(v) ? v.length === 0 : !String(v ?? '').trim()
    if (f.required && empty) return labels.required
    if (!empty && f.validate) return f.validate(v, vals)
    return null
  }

  const setField = (name: keyof V & string, v: string | string[]) => {
    setDirty(true)
    if (onAutosave) setSave('saving')
    setValues((vals) => ({ ...vals, [name]: v }))
  }

  const goTo = (i: number) => {
    setFocusPending(true)
    setDir(i > stepIdx ? 1 : -1)
    setStepIdx(i)
    setVisited((m) => Math.max(m, i))
  }

  const next = () => {
    if (onSummary) return
    const invalid = step.fields.filter((f) => errorOf(f))
    if (invalid.length) {
      setTouched((t) => ({ ...t, ...Object.fromEntries(step.fields.map((f) => [f.name, true])) }))
      fieldRefs.current[invalid[0].name]?.focus()
      return
    }
    goTo(stepIdx + 1)
  }

  // Une étape est accessible si toutes celles d'avant sont valides.
  const stepValid = (i: number) => steps[i].fields.every((f) => !errorOf(f))
  const canReach = (i: number) => i <= visited && steps.slice(0, i).every((_, k) => stepValid(k))

  const doSubmit = async () => {
    setSubmit('loading')
    try {
      await Promise.all([onSubmit(values), new Promise((r) => setTimeout(r, 700))])
      setSubmit('success')
    } catch {
      setSubmit('idle')
      toast({
        message: 'Création impossible pour le moment. Vos saisies sont conservées : réessayez.',
      })
    }
  }

  const reset = () => {
    setDirty(false)
    setValues(initialValues)
    setTouched({})
    setVisited(0)
    setStepIdx(0)
    setSubmit('idle')
    setSave('idle')
    setSavedAt(null)
  }

  const displayValue = (f: WizardField<V>) => {
    const v = values[f.name]
    if (Array.isArray(v))
      return v.length
        ? v.map((x) => f.options?.find((o) => o.value === x)?.label ?? x).join(', ')
        : '—'
    if (!v) return '—'
    const opt = f.options?.find((o) => o.value === v)
    return opt ? opt.label : `${v}${f.suffix ? ` ${f.suffix}` : ''}`
  }

  const slide = {
    initial: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * 24 }),
    animate: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * -24 }),
  }

  if (submit === 'success' && successContent)
    return <div className={className}>{successContent(values, reset)}</div>

  return (
    <div className={cx('overflow-hidden rounded-lg border border-line bg-surface', className)}>
      {/* En-tête : étapes + autosave */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 sm:px-5">
        <ol className="flex min-w-0 flex-1 items-center gap-1" aria-label="Étapes">
          {[...steps.map((s) => s.title), labels.summary].map((title, i) => {
            const state = i < stepIdx ? 'done' : i === stepIdx ? 'current' : 'todo'
            const reachable = canReach(i)
            return (
              <li key={title} className="flex min-w-0 items-center gap-1">
                {i > 0 && (
                  <span
                    aria-hidden
                    className={cx(
                      'h-px w-3 shrink-0 sm:w-5',
                      i <= stepIdx ? 'bg-primary' : 'bg-line'
                    )}
                  />
                )}
                <button
                  type="button"
                  disabled={!reachable || i === stepIdx}
                  onClick={() => goTo(i)}
                  aria-current={state === 'current' ? 'step' : undefined}
                  className={cx(
                    'flex min-w-0 items-center gap-1.5 rounded-full py-0.5 pr-1 text-left text-xs disabled:cursor-default',
                    focusRing
                  )}
                >
                  <span
                    className={cx(
                      'grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold transition-colors',
                      state === 'done' && 'bg-primary text-primary-contrast',
                      state === 'current' && 'bg-primary/12 text-primary ring-1 ring-primary',
                      state === 'todo' && 'bg-surface-2 text-ink-muted'
                    )}
                  >
                    {state === 'done' ? (
                      <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
                        <path
                          d="M3.5 8.5l3 3 6-7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span
                    className={cx(
                      'truncate',
                      state === 'current'
                        ? 'font-semibold text-ink'
                        : 'hidden text-ink-muted md:inline'
                    )}
                  >
                    {title}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        <AutosaveIndicator
          state={save}
          text={
            save === 'saved' && savedAt
              ? labels.saved(agoLabel(now - savedAt))
              : save === 'saving'
                ? labels.saving
                : save === 'error'
                  ? labels.saveError
                  : ''
          }
        />
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (onSummary) doSubmit()
          else next()
        }}
        className="px-4 py-5 sm:px-5"
      >
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={stepIdx}
            custom={dir}
            variants={slide}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: duration.base, ease: ease.out }}
            onAnimationComplete={(def) => {
              if (def === 'animate' && focusPending) {
                setFocusPending(false)
                headingRef.current?.focus({ preventScroll: true })
              }
            }}
          >
            <p className="text-xs font-medium text-ink-muted">
              {labels.stepOf(Math.min(stepIdx + 1, total + 1), total + 1)}
            </p>
            <h4
              ref={headingRef}
              tabIndex={-1}
              className="mt-0.5 font-display text-xl text-ink outline-none"
            >
              {onSummary ? labels.summary : step.title}
            </h4>
            {!onSummary && step.description && (
              <p className="mt-1 text-sm text-ink-muted">{step.description}</p>
            )}

            {!onSummary ? (
              <div className="mt-5 grid gap-x-4 gap-y-4 sm:grid-cols-2">
                {step.fields.map((f) => (
                  <Field
                    key={f.name}
                    id={`${uid}-${f.name}`}
                    field={f}
                    value={values[f.name]}
                    error={touched[f.name] ? errorOf(f) : null}
                    valid={
                      !!touched[f.name] &&
                      !errorOf(f) &&
                      !Array.isArray(values[f.name]) &&
                      !!values[f.name]
                    }
                    onChange={(v) => setField(f.name, v)}
                    onBlur={() => setTouched((t) => ({ ...t, [f.name]: true }))}
                    inputRef={(el) => {
                      fieldRefs.current[f.name] = el
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4">
                {renderSummary ? (
                  renderSummary(values, goTo)
                ) : (
                  <div className="divide-y divide-line rounded-md border border-line">
                    {steps.map((s, i) => (
                      <section key={s.id} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <h5 className="text-sm font-semibold text-ink">{s.title}</h5>
                          <button
                            type="button"
                            onClick={() => goTo(i)}
                            className={cx(
                              'rounded-sm text-sm font-medium text-primary hover:underline',
                              focusRing
                            )}
                          >
                            {labels.edit}
                          </button>
                        </div>
                        <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                          {s.fields.map((f) => (
                            <div key={f.name} className="flex justify-between gap-3 sm:block">
                              <dt className="text-ink-muted">{f.label}</dt>
                              <dd className="text-right font-medium text-ink sm:text-left">
                                {displayValue(f)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => goTo(stepIdx - 1)}
            disabled={stepIdx === 0 || submit !== 'idle'}
            className={cx(
              'h-11 rounded-full px-4 text-sm font-medium text-ink-muted hover:text-ink disabled:invisible',
              focusRing
            )}
          >
            ← {labels.back}
          </button>
          <div className="flex items-center gap-3">
            {!onSummary && (
              <span className="hidden text-xs text-ink-muted sm:inline">Entrée pour continuer</span>
            )}
            {onSummary ? (
              <ActionButton
                type="submit"
                state={submit}
                loadingLabel={labels.submitting}
                successLabel={labels.submitted}
              >
                {labels.submit}
              </ActionButton>
            ) : (
              <ActionButton type="submit">
                {stepIdx === total - 1 ? labels.review : labels.next}
              </ActionButton>
            )}
          </div>
        </div>
        {submit === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="mt-3 text-right"
          >
            <button
              type="button"
              onClick={reset}
              className={cx('text-sm font-medium text-primary hover:underline', focusRing)}
            >
              Saisir un autre dossier
            </button>
          </motion.div>
        )}
      </form>
    </div>
  )
}

function AutosaveIndicator({ state, text }: { state: SaveState; text: string }) {
  if (state === 'idle') return null
  return (
    <p
      className={cx(
        'flex shrink-0 items-center gap-1.5 text-xs',
        state === 'error'
          ? 'text-[color-mix(in_oklab,var(--color-warning)_65%,var(--color-ink))]'
          : 'text-ink-muted'
      )}
    >
      <span role="status" className="sr-only">
        {state === 'saving' ? 'Enregistrement' : state === 'saved' ? 'Enregistré' : text}
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ duration: duration.fast }}
          aria-hidden
        >
          {state === 'saving' ? (
            <span className="kit-spin block size-3 rounded-full border-[1.5px] border-current/30 border-t-current" />
          ) : state === 'saved' ? (
            <svg viewBox="0 0 16 16" className="size-3.5 text-success">
              <path
                d="M4 10.5a3 3 0 01.4-5.97A4 4 0 0112 6a2.5 2.5 0 01.5 4.95"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <path
                d="M6 10l1.6 1.6L10.5 8.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <span className="block size-2 rounded-full bg-warning" />
          )}
        </motion.span>
      </AnimatePresence>
      <span aria-hidden className="tabular-nums">
        {text}
      </span>
    </p>
  )
}

function Field<V extends WizardValues>({
  id,
  field: f,
  value,
  error,
  valid,
  onChange,
  onBlur,
  inputRef,
}: {
  id: string
  field: WizardField<V>
  value: string | string[] | undefined
  error: string | null
  valid: boolean
  onChange: (v: string | string[]) => void
  onBlur: () => void
  inputRef: (el: HTMLElement | null) => void
}) {
  const type = f.type ?? 'text'
  const errId = `${id}-err`
  const hintId = `${id}-hint`
  const describedBy = error ? errId : f.hint ? hintId : undefined
  const full = !f.half || type === 'radio' || type === 'checkboxes'

  const control =
    type === 'radio' ? (
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy}
        className="grid gap-2 sm:grid-cols-3"
        onBlur={onBlur}
      >
        {f.options?.map((o, k) => {
          const on = value === o.value
          return (
            <label
              key={o.value}
              className={cx(
                'relative flex cursor-pointer flex-col rounded-md border bg-surface p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
                on ? 'border-transparent' : 'border-line hover:border-ink/30'
              )}
            >
              {on && (
                <motion.span
                  layoutId={`${id}-ring`}
                  className="absolute inset-0 rounded-md border-2 border-primary"
                  transition={spring}
                />
              )}
              <input
                ref={k === 0 ? (inputRef as (el: HTMLInputElement | null) => void) : undefined}
                type="radio"
                name={id}
                value={o.value}
                checked={on}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              <span className="relative flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">{o.label}</span>
                {o.badge && (
                  <span className="rounded-full bg-reward/10 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-reward">
                    {o.badge}
                  </span>
                )}
              </span>
              {o.hint && <span className="relative mt-1 text-xs text-ink-muted">{o.hint}</span>}
            </label>
          )
        })}
      </div>
    ) : type === 'checkboxes' ? (
      <div
        role="group"
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy}
        className="flex flex-wrap gap-2"
      >
        {f.options?.map((o, k) => {
          const arr = Array.isArray(value) ? value : []
          const on = arr.includes(o.value)
          return (
            <label
              key={o.value}
              className={cx(
                'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
                on
                  ? 'border-primary bg-primary/[0.07] text-ink'
                  : 'border-line text-ink-muted hover:border-ink/30 hover:text-ink'
              )}
            >
              <input
                ref={k === 0 ? (inputRef as (el: HTMLInputElement | null) => void) : undefined}
                type="checkbox"
                checked={on}
                onChange={() => onChange(on ? arr.filter((x) => x !== o.value) : [...arr, o.value])}
                onBlur={onBlur}
                className="sr-only"
              />
              <span
                className={cx(
                  'grid size-4 place-items-center rounded-full border transition-colors',
                  on ? 'border-primary bg-primary text-primary-contrast' : 'border-line'
                )}
                aria-hidden
              >
                {on && (
                  <svg viewBox="0 0 16 16" className="size-2.5">
                    <path
                      d="M3.5 8.5l3 3 6-7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              {o.label}
            </label>
          )
        })}
      </div>
    ) : type === 'select' ? (
      <div className="relative">
        <select
          ref={inputRef as (el: HTMLSelectElement | null) => void}
          id={id}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={!!error}
          aria-required={f.required || undefined}
          aria-describedby={describedBy}
          className={inputCls(!!error)}
        >
          <option value="" disabled>
            {f.placeholder ?? 'Choisir…'}
          </option>
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 12 12"
          className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2 text-ink-muted"
          aria-hidden
        >
          <path
            d="M2 4.5l4 3.5 4-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ) : (
      <div className="relative">
        <input
          ref={inputRef as (el: HTMLInputElement | null) => void}
          id={id}
          type={type === 'number' ? 'text' : type}
          inputMode={f.inputMode ?? (type === 'number' ? 'decimal' : undefined)}
          autoComplete={f.autoComplete}
          value={String(value ?? '')}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={!!error}
          aria-required={f.required || undefined}
          aria-describedby={describedBy}
          className={cx(inputCls(!!error), (f.suffix || valid) && 'pr-14')}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1.5 text-sm text-ink-muted">
          {f.suffix}
          <AnimatePresence>
            {valid && (
              <motion.svg
                key="ok"
                viewBox="0 0 16 16"
                className="size-4 text-success"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={spring}
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
              </motion.svg>
            )}
          </AnimatePresence>
        </span>
      </div>
    )

  return (
    <div className={cx(full && 'sm:col-span-2')}>
      {type === 'radio' || type === 'checkboxes' ? (
        <p id={`${id}-label`} className="mb-1.5 text-sm font-medium text-ink">
          {f.label}
          {!f.required && <span className="font-normal text-ink-muted"> (facultatif)</span>}
        </p>
      ) : (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {f.label}
          {!f.required && <span className="font-normal text-ink-muted"> (facultatif)</span>}
        </label>
      )}
      {control}
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={errId}
            key="err"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast }}
            className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-danger"
          >
            <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" aria-hidden>
              <circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M8 4.8v3.6M8 10.9v.1"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      {f.hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-ink-muted">
          {f.hint}
        </p>
      )}
    </div>
  )
}

const inputCls = (err: boolean) =>
  cx(
    'h-11 w-full appearance-none rounded-md border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted/70 transition-colors focus:outline-none focus:ring-2',
    err
      ? 'border-danger focus:ring-danger/20'
      : 'border-line hover:border-ink/25 focus:border-primary focus:ring-primary/15'
  )
