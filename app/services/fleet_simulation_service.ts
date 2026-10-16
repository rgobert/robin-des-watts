import { SimulationService } from '#services/simulation_service'

/**
 * Simulated mylight150 fleet for the live BO. Mocked and labelled as such:
 * each simulated client is Claire's 2026 projection (hike, MSP gain) scaled
 * by a random factor. In memory, shared by every visitor (1 replica). No
 * timer: each snapshot() generates the events for the time elapsed since the
 * previous one, so the fleet only moves while /admin is open.
 */
export type FleetEventType = 'hausse_vue' | 'activation_demandee' | 'bascule_gagnante'

export type FleetEvent = {
  prenom: string
  ville: string
  type: FleetEventType
  eur: number
  at: number
}

export type FleetSnapshot = {
  label: string
  kpis: {
    exposed: number
    activations: number
    compensatedEur: number
    winnersRate: number
  }
  /** Activations per 5-second bucket, oldest first (last 2 minutes). */
  activationsTrend: number[]
  feed: FleetEvent[]
}

const EVENT_EVERY_MS = 350
const MAX_CATCH_UP = 400
const BUCKET_MS = 5_000
const TREND_BUCKETS = 24

const FIRST_NAMES = [
  'Martine',
  'Olivier',
  'Sophie',
  'Jean-Marc',
  'Nathalie',
  'Didier',
  'Valérie',
  'Patrick',
  'Isabelle',
  'Franck',
  'Sandrine',
  'Laurent',
  'Céline',
  'Stéphane',
  'Aurélie',
  'Christophe',
  'Élodie',
  'Pascal',
]
const CITIES = [
  'Bordeaux',
  'Toulouse',
  'Montpellier',
  'Nantes',
  'Rennes',
  'Marseille',
  'Aix-en-Provence',
  'Perpignan',
  'Pau',
  'Angers',
  'Tours',
  'Dijon',
  'Clermont-Ferrand',
  'Valence',
  'Nîmes',
  'La Rochelle',
]

const CLAIRE_HIKE_EUR = new SimulationService().nextYear().priceHikeEur
const CLAIRE_MSP_GAIN_EUR = new SimulationService().smartPilotGainEur()

type FleetClient = { prenom: string; ville: string; hikeEur: number; mspGainEur: number }

const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)]
const between = (min: number, max: number) => min + Math.random() * (max - min)

let exposed: FleetClient[] = []
let activated: FleetClient[] = []
let winners = 0
let feed: FleetEvent[] = []
let activationTimes: number[] = []
let lastTick = Date.now()

export class FleetSimulationService {
  private newClient(): FleetClient {
    return {
      prenom: pick(FIRST_NAMES),
      ville: pick(CITIES),
      hikeEur: CLAIRE_HIKE_EUR * between(0.5, 1.6),
      mspGainEur: CLAIRE_MSP_GAIN_EUR * between(0.4, 1.4),
    }
  }

  private push(event: FleetEvent) {
    feed.push(event)
    if (feed.length > 12) feed = feed.slice(-12)
  }

  /** One step of a simulated client journey: discover the hike, then maybe activate MSP. */
  private step(at: number) {
    const waiting = exposed.filter((client) => !activated.includes(client))
    if (waiting.length > 0 && Math.random() < 0.45) {
      const client = pick(waiting)
      activated.push(client)
      activationTimes.push(at)
      this.push({ ...client, type: 'activation_demandee', eur: client.mspGainEur, at })
      if (client.mspGainEur >= client.hikeEur) {
        winners++
        this.push({
          ...client,
          type: 'bascule_gagnante',
          eur: client.mspGainEur - client.hikeEur,
          at,
        })
      }
      return
    }
    const client = this.newClient()
    exposed.push(client)
    this.push({ ...client, type: 'hausse_vue', eur: client.hikeEur, at })
  }

  snapshot(): FleetSnapshot {
    const now = Date.now()
    const due = Math.min(Math.floor((now - lastTick) / EVENT_EVERY_MS), MAX_CATCH_UP)
    for (let i = 0; i < due; i++) this.step(now - (due - 1 - i) * EVENT_EVERY_MS)
    // Shared clock: two /admin tabs polling every 2 s never double the rate.
    lastTick = due === MAX_CATCH_UP ? now : lastTick + due * EVENT_EVERY_MS

    const trendStart = now - TREND_BUCKETS * BUCKET_MS
    activationTimes = activationTimes.filter((at) => at >= trendStart)
    const activationsTrend = Array.from({ length: TREND_BUCKETS }, () => 0)
    for (const at of activationTimes) {
      activationsTrend[Math.min(Math.floor((at - trendStart) / BUCKET_MS), TREND_BUCKETS - 1)]++
    }

    return {
      label: 'Parc mylight150 simulé · chiffres indicatifs',
      kpis: {
        exposed: exposed.length,
        activations: activated.length,
        compensatedEur: Math.round(
          activated.reduce((sum, client) => sum + Math.min(client.mspGainEur, client.hikeEur), 0)
        ),
        winnersRate: exposed.length ? Math.round((winners / exposed.length) * 100) : 0,
      },
      activationsTrend,
      feed: [...feed].reverse().map(({ prenom, ville, type, eur, at }) => ({
        prenom,
        ville,
        type,
        eur: Math.round(eur),
        at,
      })),
    }
  }

  reset() {
    exposed = []
    activated = []
    winners = 0
    feed = []
    activationTimes = []
    lastTick = Date.now()
  }
}
