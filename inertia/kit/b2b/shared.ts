/* Utilitaires internes au kit B2B (non exportés par l'index, sauf mention). */

export const isMacPlatform = () => {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
}

/** Minuscule, sans accents ni espaces superflus : « Vénissieux » → « venissieux ». */
export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Recherche floue par sous-séquence. Renvoie un score (plus haut = mieux) et les index trouvés,
 * ou null si la requête n'est pas contenue. Bonus : caractères consécutifs, début de mot, préfixe.
 */
export function fuzzyMatch(
  query: string,
  text: string
): { score: number; indices: number[] } | null {
  const q = normalize(query).replace(/\s+/g, ' ')
  if (!q) return { score: 0, indices: [] }
  const t = normalize(text)
  // Correspondance exacte d'une sous-chaîne : score fort et surlignage propre.
  const direct = t.indexOf(q)
  if (direct >= 0) {
    const atWord = direct === 0 || /[\s\-·/(]/.test(t[direct - 1])
    return {
      score: 100 - direct + (atWord ? 40 : 0) + q.length * 2,
      indices: Array.from({ length: q.length }, (_, i) => direct + i),
    }
  }
  const indices: number[] = []
  let score = 0
  let ti = 0
  let prev = -2
  for (const ch of q) {
    if (ch === ' ') continue
    const found = t.indexOf(ch, ti)
    if (found < 0) return null
    const atWord = found === 0 || /[\s\-·/(]/.test(t[found - 1])
    score += found === prev + 1 ? 6 : 1
    if (atWord) score += 5
    indices.push(found)
    prev = found
    ti = found + 1
  }
  // Lettres trop éparpillées = bruit (« venis » ne doit pas trouver « Villeurbanne · Demande Enedis »).
  const span = (indices[indices.length - 1] ?? 0) - (indices[0] ?? 0) + 1
  if (span > Math.max(6, indices.length * 2.5)) return null
  return { score: score - (indices[0] ?? 0) * 0.2, indices }
}

const rtf = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto', style: 'short' })

/** « à l'instant », « il y a 5 min », « il y a 3 h », « hier », « il y a 4 jours », puis la date. */
export function formatRelativeFr(date: Date | string, now: Date = new Date()) {
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = (d.getTime() - now.getTime()) / 1000
  const abs = Math.abs(diff)
  if (abs < 45) return 'à l’instant'
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400 && d.getDate() === now.getDate())
    return rtf.format(Math.round(diff / 3600), 'hour')
  const days = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86400000)
  if (Math.abs(days) < 7) return rtf.format(days, 'day')
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export function formatDayLabel(d: Date, now: Date = new Date()) {
  const days = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86400000)
  if (days === 0) return 'Aujourd’hui'
  if (days === -1) return 'Hier'
  const label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

export const plural = (n: number, one: string, many: string) =>
  `${new Intl.NumberFormat('fr-FR').format(n)} ${n > 1 ? many : one}`

/** Vrai si l'utilisateur est en train de taper (champ, zone de texte, contenu éditable). */
export const isTypingTarget = (el: EventTarget | null) => {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/** Classes de focus communes au kit. */
export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

/** Teste un événement clavier contre `['mod', 'K']`, `['shift', 'N']`, `['/']`… (modificateurs exacts). */
export function matchesShortcut(e: KeyboardEvent, keys: string[]) {
  const mods = keys.slice(0, -1).map((k) => k.toLowerCase())
  const key = (keys[keys.length - 1] ?? '').toLowerCase()
  const mac = isMacPlatform()
  const want = {
    meta: mods.includes('mod') ? mac : mods.includes('meta'),
    ctrl: mods.includes('mod') ? !mac : mods.includes('ctrl'),
    shift: mods.includes('shift'),
    alt: mods.includes('alt'),
  }
  if (e.metaKey !== want.meta || e.ctrlKey !== want.ctrl || e.altKey !== want.alt) return false
  // Pour les touches non-lettres (« / », « ? »), Maj peut être nécessaire selon le clavier : on tolère.
  const isLetter = /^[a-z0-9]$/.test(key)
  if (isLetter && e.shiftKey !== want.shift) return false
  if (isLetter)
    return (
      e.key.toLowerCase() === key ||
      e.code === `Key${key.toUpperCase()}` ||
      e.code === `Digit${key}`
    )
  return e.key.toLowerCase() === key
}
