import { cx } from '../utils'
import { isMacPlatform } from './shared'

const MAC: Record<string, string> = { mod: '⌘', shift: '⇧', alt: '⌥', ctrl: '⌃' }
const PC: Record<string, string> = { mod: 'Ctrl', shift: 'Maj', alt: 'Alt', ctrl: 'Ctrl' }
const COMMON: Record<string, string> = {
  enter: '↵',
  esc: 'Échap',
  escape: 'Échap',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  tab: 'Tab',
  space: 'Espace',
  backspace: '⌫',
}
const SPOKEN: Record<string, string> = {
  'mod': 'Commande',
  '⌘': 'Commande',
  '⇧': 'Majuscule',
  '↵': 'Entrée',
  '↑': 'Flèche haut',
  '↓': 'Flèche bas',
}

/** Transforme `'mod+K'` ou `['mod', 'K']` en symboles adaptés à la plateforme (⌘ sur Mac, Ctrl ailleurs). */
export function parseKeys(keys: string | string[], mac = isMacPlatform()) {
  const list = Array.isArray(keys) ? keys : keys.split('+')
  return list.map((k) => {
    const low = k.toLowerCase()
    return (mac ? MAC : PC)[low] ?? COMMON[low] ?? (k.length === 1 ? k.toUpperCase() : k)
  })
}

/**
 * Pastille de raccourci clavier (⌘K, Entrée, Échap…). `mod` devient ⌘ sur Mac et Ctrl ailleurs.
 * Friction traitée : les raccourcis existent mais personne ne les connaît ; on les montre là où l'action se trouve.
 */
export function KeyboardHint({
  keys,
  tone = 'default',
  size = 'sm',
  className,
}: {
  /** `'mod+K'`, `['shift', 'N']`, `'enter'`… */
  keys: string | string[]
  tone?: 'default' | 'inverse' | 'subtle'
  size?: 'xs' | 'sm'
  className?: string
}) {
  const parts = parseKeys(keys)
  return (
    <span className={cx('inline-flex items-center gap-0.5 align-middle', className)}>
      {/* aria-label n'est pas lu sur un span générique : texte masqué à la place. */}
      <span className="sr-only">{`Raccourci : ${parts.map((p) => SPOKEN[p] ?? p).join(' + ')}`}</span>
      {parts.map((p, i) => (
        <kbd
          key={i}
          aria-hidden
          className={cx(
            'inline-grid place-items-center rounded-[5px] border font-body font-medium leading-none tabular-nums',
            size === 'xs'
              ? 'h-[18px] min-w-[18px] px-1 text-[10px]'
              : 'h-5 min-w-5 px-1.5 text-[11px]',
            tone === 'default' &&
              'border-line border-b-[color-mix(in_oklab,var(--color-line),var(--color-ink)_18%)] bg-surface text-ink-muted',
            tone === 'subtle' && 'border-transparent bg-surface-2 text-ink-muted',
            tone === 'inverse' && 'border-canvas/20 bg-canvas/10 text-canvas'
          )}
        >
          {p}
        </kbd>
      ))}
    </span>
  )
}
