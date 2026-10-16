import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { AssistantAvatar } from '../../components/assistant_avatar'
import { useToast } from '../../components/toast'
import { duration, ease } from '../../motion'
import { cx } from '../../utils'
import { LockIcon, fmtDuration, fmtEur, fmtTime, useClock } from './shared'

export type OptOutChoice = 'pending' | 'accepted' | 'declined'

type Labels = {
  accept: string
  decline: string
  defaultNote: string
  editableUntil: string
  locked: string
  declinedNote: string
}
const DEFAULT_LABELS: Labels = {
  accept: 'Accepter',
  decline: 'Pas demain',
  defaultNote: 'Sans réponse de votre part, Robin pilote comme prévu.',
  editableUntil: 'Modifiable jusqu’à',
  locked: 'Choix verrouillé',
  declinedNote:
    'Aucune pénalité : Robin ne touche pas à la PAC sur ce créneau, le mode Smart reste actif le reste du temps.',
}

/**
 * Avis de pilotage la veille, avec opt-out explicite : « Robin pilotera votre PAC demain 18h-20h,
 * +1,20 € estimés ». Accepter / Pas demain, rappel du confort garanti, choix modifiable jusqu'au
 * verrouillage (23h59 la veille), affiché avec le temps restant.
 * Friction traitée : l'automatisation subie inquiète (« et si j'ai froid ? ») et pousse à couper le
 * mode Smart entier ; prévenir la veille préserve le contrôle (un préavis court fait perdre ~25 % de
 * la réponse, Centre for Net Zero).
 * Pattern : P12 (Hilo, Hydro-Québec).
 */
export function OptOutTomorrow({
  appliance = 'PAC',
  windowLabel = '18h-20h',
  dayLabel = 'demain',
  estimatedGain = 1.2,
  comfort = 'Votre logement reste entre 19 et 21 °C. Si la température passe sous 19 °C, Robin rend la main aussitôt.',
  how = 'Robin préchauffe la maison avec votre soleil entre 14h et 16h, puis baisse la PAC pendant la pointe du réseau.',
  lockAt = new Date(2026, 9, 14, 23, 59),
  now,
  choice: choiceProp = 'pending',
  onChoiceChange,
  labels: labelsProp,
  className,
}: {
  appliance?: string
  windowLabel?: string
  dayLabel?: string
  /** Gain estimé pour le foyer (€). */
  estimatedGain?: number
  /** Garantie de confort, rappelée en clair. */
  comfort?: string
  how?: string
  /** Heure de verrouillage du choix (la veille). */
  lockAt?: Date
  /** Heure de départ de l'horloge (démo). */
  now?: Date
  choice?: OptOutChoice
  onChoiceChange?: (c: OptOutChoice) => void
  labels?: Partial<Labels>
  className?: string
}) {
  const L = { ...DEFAULT_LABELS, ...labelsProp }
  const toast = useToast()
  const clock = useClock(now)
  const [choice, setChoice] = useState<OptOutChoice>(choiceProp)
  const locked = clock.getTime() >= lockAt.getTime()
  const remaining = lockAt.getTime() - clock.getTime()
  const effective: OptOutChoice = choice === 'pending' && locked ? 'accepted' : choice

  const pick = (c: OptOutChoice) => {
    if (locked || c === choice) return
    const prev = choice
    setChoice(c)
    onChoiceChange?.(c)
    toast({
      message:
        c === 'accepted'
          ? `C’est noté : Robin pilote votre ${appliance} ${dayLabel} ${windowLabel}.`
          : `C’est noté : pas de pilotage ${dayLabel} ${windowLabel}.`,
      tone: c === 'accepted' ? 'success' : 'neutral',
      actionLabel: 'Annuler',
      onAction: () => {
        setChoice(prev)
        onChoiceChange?.(prev)
      },
    })
  }

  return (
    <div
      className={cx('rounded-lg border border-line bg-surface p-4 shadow-card sm:p-5', className)}
      role="region"
      aria-label={`Pilotage ${dayLabel} de votre ${appliance}`}
    >
      <div className="flex items-start gap-3">
        <AssistantAvatar mood={effective === 'declined' ? 'idle' : 'happy'} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug font-medium text-ink">
            Robin pilotera votre {appliance} {dayLabel} {windowLabel},{' '}
            <span className="whitespace-nowrap">+{fmtEur(estimatedGain)} estimés</span>
          </p>
          <p className="mt-1 text-sm text-ink-muted">{how}</p>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-md bg-surface-2 px-3 py-2.5 text-sm text-ink">
        <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0" aria-hidden>
          <path
            d="M8 1.5l5 2v4c0 3-2.2 5.6-5 7-2.8-1.4-5-4-5-7v-4z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M5.6 8l1.7 1.7L10.6 6.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>
          <strong className="font-semibold">Confort garanti.</strong> {comfort}
        </span>
      </div>

      <div
        className="mt-4 grid grid-cols-2 gap-2"
        role="group"
        aria-label="Votre choix pour demain"
      >
        {(['accepted', 'declined'] as const).map((c) => {
          const on = effective === c
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              disabled={locked}
              onClick={() => pick(c)}
              className={cx(
                'inline-flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed',
                on && c === 'accepted' && 'bg-primary text-primary-contrast',
                on && c === 'declined' && 'bg-ink text-canvas',
                !on && 'border border-line bg-surface text-ink hover:border-ink/30',
                locked && !on && 'opacity-50'
              )}
            >
              {on && (
                <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
                  <path
                    d="M3.5 8.5l3 3 6-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {c === 'accepted' ? L.accept : L.decline}
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={`${effective}-${locked}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.fast, ease: ease.out }}
          className="mt-3 flex items-start gap-1.5 text-xs text-ink-muted"
          aria-live="polite"
        >
          {locked ? (
            <>
              <LockIcon className="mt-px shrink-0 text-ink" />
              <span>
                <strong className="font-semibold text-ink">{L.locked}</strong> depuis{' '}
                {fmtTime(lockAt)} la veille :{' '}
                {effective === 'accepted'
                  ? `Robin pilote ${windowLabel}. Vous pouvez toujours reprendre la main pendant le créneau depuis l’accueil.`
                  : 'pas de pilotage sur ce créneau.'}
              </span>
            </>
          ) : (
            <span>
              {choice === 'pending' && <>{L.defaultNote} </>}
              {choice === 'declined' && <>{L.declinedNote} </>}
              {L.editableUntil} ce soir {fmtTime(lockAt)}{' '}
              <span className="tabular-nums">(encore {fmtDuration(remaining)})</span>.
            </span>
          )}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
