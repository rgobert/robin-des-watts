import type { HttpContext } from '@adonisjs/core/http'
import { randomUUID } from 'node:crypto'

/**
 * Live demo loop FO → BO.
 * In memory and shared by every visitor (1 replica): a deploy or the
 * admin reset clears it.
 */
export const EVENT_TYPES = [
  'page_vue',
  'carte_vue',
  'hausse_vue',
  'levier_bascule',
  'capacite_changee',
  'bascule_gagnante',
  'activation_demandee',
  'vue_changee',
  'partage_retro',
  'partage_ouvert',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

export const VARIANTES = ['euros', 'impact'] as const
export type Variante = (typeof VARIANTES)[number]

export type DemoProfile = { visitorId: string; prenom: string; ville: string; variante: Variante }

/** Retro story slide ids, both readings (same ids as `carte_vue` and `buildSlides` in intro.tsx). */
export const SLIDE_IDS = [
  'intro',
  'hausse',
  'valeur_nette',
  'meilleur_jour',
  'co2',
  'autoconsommation',
  'record',
  'jours_sans_reseau',
  'trophees',
  'cta',
] as const
export type SlideId = (typeof SLIDE_IDS)[number]

/** `?slide=` of a shared link, kept only when it names a real slide. */
export const slideParam = (value: unknown) => SLIDE_IDS.find((id) => id === value) ?? null

/** Last retro card of each variant: seeing it means the story was read to the end. */
const LAST_CARD: Record<Variante, string> = { euros: 'valeur_nette', impact: 'jours_sans_reseau' }

type LiveEvent = DemoProfile & {
  type: EventType
  props: Record<string, string | number | boolean>
  at: number
}

const FIRST_NAMES = [
  'Karim',
  'Julie',
  'Thomas',
  'Inès',
  'Lucas',
  'Camille',
  'Hugo',
  'Léa',
  'Nadia',
  'Antoine',
  'Sarah',
  'Mehdi',
  'Emma',
  'Paul',
  'Chloé',
  'Yanis',
  'Manon',
  'Louis',
  'Zoé',
  'Bastien',
]
const CITIES = ['Lyon', 'Villeurbanne', 'Grenoble', 'Annecy', 'Vienne', 'Bron', 'Écully', 'Caluire']

const CLAIRE = { prenom: 'Claire', ville: 'Lyon' }

let events: LiveEvent[] = []
// Alternating assignment (not random) guarantees a 50/50 split on a small room.
let assigned = 0

const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)]

export class DemoLiveService {
  /**
   * Demo profile stored in the session, no login. Sticky A/B variant.
   * `?profil=claire` forces the persona and `?variante=euros|impact` the variant, on stage.
   */
  profile({ session, request }: HttpContext): DemoProfile {
    const existing = session.get('profil') as Partial<DemoProfile> | undefined
    const forceClaire = request.input('profil') === 'claire'
    const forced = VARIANTES.find((v) => v === request.input('variante'))
    if (
      existing?.visitorId &&
      existing.variante &&
      (!forceClaire || existing.prenom === CLAIRE.prenom) &&
      (!forced || existing.variante === forced)
    ) {
      return existing as DemoProfile
    }
    const profile: DemoProfile = {
      visitorId: existing?.visitorId ?? randomUUID(),
      ...(forceClaire
        ? CLAIRE
        : existing?.prenom && existing.ville
          ? { prenom: existing.prenom, ville: existing.ville }
          : { prenom: pick(FIRST_NAMES), ville: pick(CITIES) }),
      variante: forced ?? existing?.variante ?? VARIANTES[assigned++ % 2],
    }
    session.put('profil', profile)
    return profile
  }

  /** `partage_ouvert` once per session when someone opens a shared retro link. */
  sharedLinkOpened(ctx: HttpContext, profile: DemoProfile) {
    const ref = ctx.request.input('ref')
    if (typeof ref !== 'string' || !ref || ref === profile.visitorId) return
    if (ctx.session.get('partage_ouvert')) return
    ctx.session.put('partage_ouvert', true)
    this.record(profile, 'partage_ouvert', {
      ref: ref.slice(0, 40),
      slide: slideParam(ctx.request.input('slide')) ?? 'aucune',
    })
  }

  record(profile: DemoProfile, type: EventType, props: LiveEvent['props'] = {}) {
    events.push({ ...profile, type, props, at: Date.now() })
  }

  reset() {
    events = []
  }

  dashboard() {
    const visitorsWith = (type: EventType, filter: (e: LiveEvent) => boolean = () => true) =>
      new Set(events.filter((e) => e.type === type && filter(e)).map((e) => e.visitorId))

    const visitors = new Set(events.map((e) => e.visitorId))
    const activations = events.filter((e) => e.type === 'activation_demandee')
    // One activation per visitor: a second click does not compensate the hike twice.
    const activationByVisitor = new Map(
      activations.map((e) => [e.visitorId, Number(e.props.gain_eur_an ?? 0)])
    )
    const winners = visitorsWith('bascule_gagnante')
    const capacityChanges = events.filter((e) => e.type === 'capacite_changee')
    const tried300 = visitorsWith('capacite_changee', (e) => e.props.vers === 300)
    const left300 = visitorsWith('capacite_changee', (e) => e.props.de === 300)

    const varianteOf = new Map(events.map((e) => [e.visitorId, e.variante]))
    const abRow = (v: Variante) => {
      const of = (type: EventType, filter: (e: LiveEvent) => boolean = () => true) =>
        visitorsWith(type, (e) => e.variante === v && filter(e)).size
      return {
        exposed: of('page_vue', (e) => e.props.page === 'retro'),
        year2: of('page_vue', (e) => e.props.page === 'annee_2'),
        activations: of('activation_demandee'),
        shares: of('partage_retro'),
        sharedOpens: new Set(
          events
            .filter((e) => e.type === 'partage_ouvert' && varianteOf.get(String(e.props.ref)) === v)
            .map((e) => e.visitorId)
        ).size,
        finishedStory: of('carte_vue', (e) => e.props.carte === LAST_CARD[v]),
      }
    }
    // Which retro slide people want to show: distinct sharers and link opens per slide.
    const sharesBySlide = SLIDE_IDS.map((slide) => {
      const shared = events.filter((e) => e.type === 'partage_retro' && e.props.slide === slide)
      const byVue = (vue: Variante) => shared.filter((e) => e.props.vue === vue).length
      return {
        slide,
        shares: new Set(shared.map((e) => e.visitorId)).size,
        opens: visitorsWith('partage_ouvert', (e) => e.props.slide === slide).size,
        topVue:
          shared.length < 3 || byVue('euros') === byVue('impact')
            ? null
            : byVue('euros') > byVue('impact')
              ? ('euros' as const)
              : ('impact' as const),
      }
    }).sort((a, b) => b.shares - a.shares || b.opens - a.opens)
    const sharers = visitorsWith('partage_retro').size

    const euros = abRow('euros')
    const impact = abRow('impact')

    return {
      sharesBySlide: { sharers, slides: sharesBySlide },
      abTest: { n: { euros: euros.exposed, impact: impact.exposed }, euros, impact },
      kpis: {
        visitors: visitors.size,
        activations: activationByVisitor.size,
        compensatedEur: Math.round(
          [...activationByVisitor.values()].reduce((sum, gain) => sum + gain, 0)
        ),
        winnersRate: visitors.size ? Math.round((winners.size / visitors.size) * 100) : 0,
      },
      funnel: [
        {
          step: 'Rétro vue',
          count: visitorsWith('page_vue', (e) => e.props.page === 'retro').size,
        },
        {
          step: 'Année 2 vue',
          count: visitorsWith('page_vue', (e) => e.props.page === 'annee_2').size,
        },
        { step: 'Levier basculé', count: visitorsWith('levier_bascule').size },
        { step: 'Gagnant malgré la hausse', count: winners.size },
        { step: 'Activation demandée', count: visitorsWith('activation_demandee').size },
      ],
      formulas: {
        upgrades: capacityChanges.filter((e) => e.props.sens === 'upgrade').length,
        downgrades: capacityChanges.filter((e) => e.props.sens === 'downgrade').length,
        tried300ThenLeft: [...tried300].filter((id) => left300.has(id)).length,
      },
      feed: events
        .slice(-10)
        .reverse()
        .map((e) => ({ prenom: e.prenom, ville: e.ville, type: e.type, props: e.props, at: e.at })),
    }
  }
}
