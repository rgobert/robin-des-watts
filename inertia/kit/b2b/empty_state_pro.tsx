import { motion } from 'motion/react'
import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { ActionButton } from '../components/action_button'
import { duration, ease, fadeUp, stagger } from '../motion'
import { cx } from '../utils'
import { focusRing } from './shared'

type Action = { label: string; onClick?: () => void; icon?: ReactNode }

/**
 * État vide utile : ce qui manque, l'action principale pour en sortir (importer un CSV, créer le premier dossier),
 * une action secondaire et un lien d'aide. Si `onFiles` est fourni, la zone accepte aussi le glisser-déposer.
 * Friction traitée : l'écran vide « Aucune donnée » qui ne dit pas quoi faire ; le partenaire repart sans rien créer.
 */
export function EmptyStatePro({
  title,
  description,
  primaryAction,
  secondaryAction,
  help,
  onFiles,
  accept = '.csv,text/csv',
  dropLabel = 'ou déposez votre fichier ici',
  illustration,
  className,
}: {
  title: string
  description?: ReactNode
  primaryAction: Action
  secondaryAction?: Action
  help?: { label: string; href?: string; onClick?: () => void }
  /** Active le dépôt de fichier. Sans `primaryAction.onClick`, le bouton principal ouvre le sélecteur de fichier. */
  onFiles?: (files: File[]) => void
  accept?: string
  dropLabel?: string
  illustration?: ReactNode
  className?: string
}) {
  const [over, setOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const dropProps = onFiles
    ? {
        onDragOver: (e: DragEvent) => {
          e.preventDefault()
          setOver(true)
        },
        onDragLeave: (e: DragEvent) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false)
        },
        onDrop: (e: DragEvent) => {
          e.preventDefault()
          setOver(false)
          const files = [...e.dataTransfer.files]
          if (files.length) onFiles(files)
        },
      }
    : {}

  return (
    <motion.div
      {...dropProps}
      variants={stagger(0.06)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      className={cx(
        'relative rounded-lg border border-dashed px-6 py-10 text-center transition-colors',
        over ? 'border-primary bg-primary/[0.05]' : 'border-line bg-surface/70',
        className
      )}
    >
      <motion.div variants={fadeUp} className="mx-auto w-fit">
        {illustration ?? <StackIllustration lifted={over} />}
      </motion.div>
      <motion.p variants={fadeUp} className="mt-4 font-display text-lg text-ink">
        {title}
      </motion.p>
      {description && (
        <motion.p variants={fadeUp} className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
          {description}
        </motion.p>
      )}
      <motion.div
        variants={fadeUp}
        className="mt-5 flex flex-wrap items-center justify-center gap-2"
      >
        <ActionButton onClick={primaryAction.onClick ?? (() => fileRef.current?.click())}>
          {primaryAction.icon}
          {primaryAction.label}
        </ActionButton>
        {secondaryAction && (
          <ActionButton variant="secondary" onClick={secondaryAction.onClick}>
            {secondaryAction.icon}
            {secondaryAction.label}
          </ActionButton>
        )}
      </motion.div>
      {onFiles && (
        <motion.p variants={fadeUp} className="mt-3 text-xs text-ink-muted">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={cx(
              'rounded-sm underline-offset-2 hover:text-ink hover:underline',
              focusRing
            )}
          >
            {dropLabel}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const files = [...(e.target.files ?? [])]
              if (files.length) onFiles(files)
              e.target.value = ''
            }}
          />
        </motion.p>
      )}
      {help && (
        <motion.p variants={fadeUp} className="mt-4 text-sm">
          {help.href ? (
            <a
              href={help.href}
              onClick={help.onClick}
              className={cx('rounded-sm font-medium text-primary hover:underline', focusRing)}
            >
              {help.label} →
            </a>
          ) : (
            <button
              type="button"
              onClick={help.onClick}
              className={cx('rounded-sm font-medium text-primary hover:underline', focusRing)}
            >
              {help.label} →
            </button>
          )}
        </motion.p>
      )}
    </motion.div>
  )
}

function StackIllustration({ lifted }: { lifted: boolean }) {
  return (
    <svg viewBox="0 0 96 72" className="h-16 w-24" aria-hidden>
      <rect x="18" y="20" width="56" height="44" rx="6" className="fill-surface-2" />
      <motion.g
        animate={{ y: lifted ? -6 : 0 }}
        transition={{ duration: duration.base, ease: ease.out }}
      >
        <rect
          x="24"
          y="10"
          width="52"
          height="46"
          rx="6"
          className="fill-surface stroke-line"
          strokeWidth="1.5"
        />
        <rect x="32" y="20" width="22" height="4" rx="2" className="fill-primary/70" />
        <rect x="32" y="29" width="34" height="3" rx="1.5" className="fill-line" />
        <rect x="32" y="36" width="28" height="3" rx="1.5" className="fill-line" />
        <rect x="32" y="43" width="31" height="3" rx="1.5" className="fill-line" />
        <circle cx="70" cy="14" r="9" className="fill-solar" />
        <path d="M70 10v8M66 14h8" className="stroke-ink" strokeWidth="1.8" strokeLinecap="round" />
      </motion.g>
    </svg>
  )
}
