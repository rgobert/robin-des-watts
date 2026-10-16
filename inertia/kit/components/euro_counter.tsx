import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { ease } from '../motion'
import { cx } from '../utils'
import { WhyThis } from './explain'

/** Miroir de --dur-count et --dur-count-stagger (tokens.css), en secondes pour Motion. */
const COUNT_DURATION = 0.9
const COUNT_STAGGER = 0.04

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const
const NNBSP = ' ' // espace fine insécable : milliers et « € »
const MINUS = '−'

const fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

type Hypothesis = { label: string; value: string }

type Props = {
  /** € par an, signé : négatif = perte due à la hausse du 1/11, positif = gain. */
  value: number
  /** Remplace le libellé d’état (« hausse du 1/11 » / « gagnante »). */
  label?: string
  /** Base du calcul, toujours affichée sous le chiffre. */
  basis?: string
  /** `hero` sur /annee-2, `compact` en tête de /. */
  size?: 'hero' | 'compact'
  /** Si fourni, la base devient un `WhyThis` qui déplie les hypothèses. */
  hypotheses?: Hypothesis[]
  source?: string
  className?: string
}

type Glyph = { key: string; kind: 'digit'; digit: number } | { key: string; kind: 'sep' }

/** Découpe « 1 234 » en glyphes clés par position depuis la droite : les unités gardent leur identité. */
function toGlyphs(abs: number): Glyph[] {
  const chars = [...fmt.format(abs)].reverse()
  let d = 0
  let s = 0
  return chars
    .map<Glyph>((c) =>
      /\d/.test(c)
        ? { key: `d${d++}`, kind: 'digit', digit: Number(c) }
        : { key: `s${s++}`, kind: 'sep' }
    )
    .reverse()
}

function sentence(rounded: number, abs: string) {
  if (rounded < 0) return `Le 1/11 vous coûtera ${abs} € sur un an`
  if (rounded === 0) return 'Hausse compensée : 0 € sur un an'
  return `Vous êtes gagnante : +${abs} € par an`
}

/**
 * Compteur € signature : la hausse du 1/11 qui bascule en gain, chiffre par chiffre.
 * Friction traitée : un montant qui change sans mouvement ne relie pas l’action (interrupteur) à son effet ;
 * un montant sans base ni état écrit n’inspire pas confiance. Ici le roulement montre le sens du changement,
 * le halo marque une seule fois la traversée de zéro, la base « projeté » est toujours visible et l’état est dit en texte.
 * Pas d’animation au montage ni en boucle : le compteur ne bouge que sur action.
 */
export function EuroCounter({
  value,
  label,
  basis = 'projeté sur votre profil 2026',
  size = 'hero',
  hypotheses,
  source,
  className,
}: Props) {
  const reduce = useReducedMotion() ?? false
  const rounded = Math.round(value) || 0 // évite -0
  const win = rounded >= 0
  const abs = Math.abs(rounded)
  const glyphs = toGlyphs(abs)
  const sign = rounded < 0 ? MINUS : rounded > 0 ? '+' : ''
  const stateLabel = label ?? (win ? 'gagnante' : 'hausse du 1/11')
  const hero = size === 'hero'

  // Compte les traversées de zéro (état dérivé du rendu précédent, sans ref muté) : le halo ne joue
  // qu'après une vraie bascule, jamais au montage.
  const [prevWin, setPrevWin] = useState(win)
  const [crossings, setCrossings] = useState(0)
  if (win !== prevWin) {
    setPrevWin(win)
    setCrossings((c) => c + 1)
  }

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cx(
          'relative isolate overflow-hidden rounded-lg',
          hero ? 'px-6 py-6' : 'px-4 py-3',
          className
        )}
      >
        {/* Fonds des deux états en fondu croisé (opacité seulement) */}
        <motion.span
          aria-hidden
          className="absolute inset-0 -z-10 bg-hike-surface"
          initial={false}
          animate={{ opacity: win ? 0 : 1 }}
          transition={{ duration: reduce ? 0 : COUNT_DURATION, ease: ease.out }}
        />
        <motion.span
          aria-hidden
          className="absolute inset-0 -z-10 bg-win-surface"
          initial={false}
          animate={{ opacity: win ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : COUNT_DURATION, ease: ease.out }}
        />

        <div
          className={cx('flex', hero ? 'flex-col gap-2' : 'flex-wrap items-center gap-x-3 gap-y-1')}
        >
          <p
            className={cx(
              'font-medium',
              hero ? 'text-sm' : 'order-2 text-xs',
              win ? 'text-win' : 'text-hike'
            )}
          >
            {stateLabel}
          </p>

          <div
            aria-hidden
            className={cx(
              'relative inline-flex items-center self-start leading-none font-semibold tracking-[-0.02em] tabular-nums',
              hero ? 'text-num-hero' : 'text-3xl',
              win ? 'text-win' : 'text-hike'
            )}
          >
            {/* Halo unique à la traversée de zéro : remonté (key) à chaque bascule, jamais en boucle */}
            {!reduce && crossings > 0 && (
              <motion.span
                key={crossings}
                className="pointer-events-none absolute -inset-x-[12%] -inset-y-[35%] -z-10 rounded-full bg-sun-glow"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: [0, 1, 0], scale: [0.8, 1.08, 1.2] }}
                transition={{ duration: COUNT_DURATION, ease: ease.out, times: [0, 0.35, 1] }}
              />
            )}

            <AnimatePresence initial={false} mode="popLayout">
              {sign && (
                <motion.span
                  key={sign}
                  layout="position"
                  className="inline-block"
                  initial={{ opacity: 0, y: '-0.3em' }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: '0.3em' }}
                  transition={{ duration: reduce ? 0 : COUNT_DURATION / 2, ease: ease.out }}
                >
                  {sign}
                </motion.span>
              )}
              {glyphs.map((g) => {
                if (g.kind === 'sep') {
                  return (
                    <motion.span key={g.key} layout="position" className="inline-block">
                      {NNBSP}
                    </motion.span>
                  )
                }
                const fromRight = Number(g.key.slice(1))
                return (
                  <DigitColumn
                    key={g.key}
                    digit={g.digit}
                    delay={reduce ? 0 : fromRight * COUNT_STAGGER}
                    reduce={reduce}
                  />
                )
              })}
              <motion.span key="euro" layout="position" className="inline-block">
                {NNBSP}€
              </motion.span>
            </AnimatePresence>
          </div>

          <div className={cx(hero ? 'mt-1' : 'order-3 basis-full')}>
            {hypotheses?.length ? (
              <WhyThis
                title={basis}
                hypotheses={hypotheses}
                source={source}
                className={hero ? 'text-sm' : 'text-xs'}
              />
            ) : (
              <span className="inline-flex rounded-sm border border-dashed border-proj-border px-2 py-0.5 text-xs text-ink-muted">
                {basis}
              </span>
            )}
          </div>
        </div>

        {/* Annonce lecteur d’écran : la valeur finale en mots, pas les étapes du roulement */}
        <p aria-live="polite" className="sr-only">
          {sentence(rounded, fmt.format(abs))}
        </p>
      </div>
    </MotionConfig>
  )
}

/** Une colonne 0-9 qui glisse jusqu’au chiffre visé. Nouvelle colonne : fondu + roulement depuis 0. */
function DigitColumn({ digit, delay, reduce }: { digit: number; delay: number; reduce: boolean }) {
  return (
    <motion.span
      layout="position"
      className="relative inline-block h-[1.1em] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : COUNT_DURATION / 3, ease: ease.out }}
    >
      <motion.span
        className="flex flex-col"
        initial={{ y: '0%' }}
        animate={{ y: `${-digit * 10}%` }}
        transition={reduce ? { duration: 0 } : { duration: COUNT_DURATION, ease: ease.out, delay }}
      >
        {DIGITS.map((d) => (
          <span key={d} className="block h-[1.1em] leading-[1.1]">
            {d}
          </span>
        ))}
      </motion.span>
    </motion.span>
  )
}
