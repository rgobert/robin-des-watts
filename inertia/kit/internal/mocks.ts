/*
 * Données FICTIVES du kit interne (pilotage mylight150).
 * Scénario : ~35 000 foyers, MRR ≈ 1,05 M€, churn mensuel 1,3-1,6 %, creux d'acquisition après
 * la baisse du tarif d'achat S21 (5 juin 2026), campagne de rentrée le 8 septembre.
 * Tout est généré de façon déterministe (graine fixe) : mêmes chiffres à chaque rechargement.
 * « Aujourd'hui » = lundi 12 octobre 2026.
 */

export const MOCK_TODAY = '2026-10-12'
const DATA_START = '2024-10-01'

/* ---------- utilitaires dates (UTC, ISO AAAA-MM-JJ) ---------- */
const DAY = 86_400_000
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`)
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
export const addDays = (iso: string, n: number) => toIso(toMs(iso) + n * DAY)
export const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY)

const lastOf = <T>(xs: T[]) => xs[xs.length - 1]

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---------- offres ---------- */
export type OfferId = 'smartbattery' | 'mybattery' | 'encore'
export const OFFERS: Record<OfferId, { label: string; arpu: number }> = {
  smartbattery: { label: 'MySmartBattery', arpu: 27.4 },
  encore: { label: 'ENCORE', arpu: 62 },
  mybattery: { label: 'MyBattery', arpu: 13.8 },
}
const OFFER_IDS: OfferId[] = ['smartbattery', 'encore', 'mybattery']

/** Part de chaque offre dans la base à une date (ENCORE progresse, MyBattery recule). */
function offerShares(t: number): Record<OfferId, number> {
  const encore = 0.16 + 0.05 * t
  const mybattery = 0.33 - 0.04 * t
  return { encore, mybattery, smartbattery: 1 - encore - mybattery }
}

/* ---------- série quotidienne ---------- */
export type DayPoint = {
  date: string
  newCustomers: number
  churned: number
  active: number
  mrr: number
  mrrByOffer: Record<OfferId, number>
  smartRate: number
  smartRateEncore: number
}

const WEEKDAY = [0.7, 1.15, 1.1, 1.05, 1.0, 0.95, 0.75] // dim → sam
const SEASON = [0.82, 0.86, 1.02, 1.14, 1.2, 1.16, 1.0, 0.86, 1.04, 1.02, 0.92, 0.8] // janv → déc

function acquisitionFactor(date: string) {
  const d = daysBetween('2026-06-05', date)
  if (d < 0) return 1
  if (d < 7) return 0.52 // choc S21
  if (d < 88) return 0.55 + (0.3 * (d - 7)) / 81 // remontée lente jusqu'à fin août
  const sept = daysBetween('2026-09-08', date)
  if (sept >= 0 && sept < 12) return 1.12 // campagne de rentrée
  return 0.88
}

function simulate(startActive: number): DayPoint[] {
  const rnd = mulberry32(150)
  const total = daysBetween(DATA_START, MOCK_TODAY)
  let active = startActive
  const out: DayPoint[] = []
  for (let i = 0; i <= total; i++) {
    const date = addDays(DATA_START, i)
    const dt = new Date(`${date}T00:00:00Z`)
    const t = i / total
    const base = 31 + 6 * t
    const noise = 0.82 + rnd() * 0.36
    const newCustomers = Math.round(
      base * WEEKDAY[dt.getUTCDay()] * SEASON[dt.getUTCMonth()] * acquisitionFactor(date) * noise
    )
    const monthlyChurn =
      0.0138 + (rnd() - 0.5) * 0.004 + (daysBetween('2026-06-20', date) > 0 ? 0.0012 : 0)
    const churned = Math.round((active * monthlyChurn) / 30.4 + (rnd() - 0.5) * 3)
    active = active + newCustomers - churned
    const shares = offerShares(t)
    const mrrByOffer = Object.fromEntries(
      OFFER_IDS.map((o) => [o, active * shares[o] * OFFERS[o].arpu])
    ) as Record<OfferId, number>
    const encoreDrop =
      daysBetween('2026-10-05', date) >= 0
        ? 0.12 * Math.min(1, (daysBetween('2026-10-05', date) + 1) / 3)
        : 0
    const smartRateEncore = (0.81 + 0.02 * t) * (1 - encoreDrop) + (rnd() - 0.5) * 0.004
    out.push({
      date,
      newCustomers,
      churned,
      active,
      mrr: OFFER_IDS.reduce((s, o) => s + mrrByOffer[o], 0),
      mrrByOffer,
      smartRateEncore,
      smartRate: (0.755 + 0.03 * t) * (1 - shares.encore) + smartRateEncore * shares.encore,
    })
  }
  return out
}

/** On résout le point de départ pour tomber sur ~35 040 foyers aujourd'hui (la dynamique est linéaire en S). */
export const DAILY: DayPoint[] = (() => {
  const target = 35_040
  const a = lastOf(simulate(26_000)).active
  const b = lastOf(simulate(28_000)).active
  const start = 26_000 + ((target - a) * 2_000) / (b - a)
  return simulate(Math.round(start))
})()

/* ---------- périodes ---------- */
export type PeriodKey = '7d' | '30d' | '90d' | '12m' | 'custom'
export type DateRange = { from: string; to: string }

export const PERIOD_DAYS: Record<Exclude<PeriodKey, 'custom'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '12m': 365,
}

/** Plage de dates d'un preset, se terminant aujourd'hui. */
export function rangeForPeriod(key: Exclude<PeriodKey, 'custom'>): DateRange {
  return { from: addDays(MOCK_TODAY, -(PERIOD_DAYS[key] - 1)), to: MOCK_TODAY }
}

/** Bornes acceptées pour une plage personnalisée (il faut une période précédente de même longueur). */
export const CUSTOM_BOUNDS = { min: addDays(DATA_START, 366), max: MOCK_TODAY }

export type Annotation = { date: string; label: string; detail?: string }
export const EVENTS: Annotation[] = [
  {
    date: '2026-06-05',
    label: 'S21, 5 juin',
    detail: 'Baisse du tarif d’achat S21 : les installations neuves ralentissent.',
  },
  {
    date: '2026-09-08',
    label: 'Campagne rentrée',
    detail: 'Campagne installateurs + emailing simulateur.',
  },
  {
    date: '2026-10-05',
    label: 'Firmware Robin 4.2',
    detail: 'Déploiement sur les coffrets des clients ENCORE.',
  },
]

export type SeriesPoint = { date: string; value: number }

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

/** Sous-échantillonne en semaines (somme pour un flux, dernière valeur pour un stock). */
function bucket(
  days: DayPoint[],
  size: number,
  pick: (d: DayPoint) => number,
  mode: 'sum' | 'last'
): SeriesPoint[] {
  if (size <= 1) return days.map((d) => ({ date: d.date, value: pick(d) }))
  const out: SeriesPoint[] = []
  for (let i = days.length; i > 0; i -= size) {
    const chunk = days.slice(Math.max(0, i - size), i)
    out.unshift({
      date: chunk[chunk.length - 1]!.date,
      value: mode === 'sum' ? sum(chunk.map(pick)) : pick(chunk[chunk.length - 1]!),
    })
  }
  return out
}

function sample(values: number[], n = 12) {
  if (values.length <= n) return values
  return Array.from(
    { length: n },
    (_, i) => values[Math.round((i * (values.length - 1)) / (n - 1))]
  )
}

export type FunnelStepData = { label: string; value: number; hint?: string }

/** Période de comparaison : la précédente de même durée, ou la même période un an plus tôt (à la Stripe). */
export type CompareMode = 'previous' | 'year'

export type DashboardData = {
  compare: CompareMode
  /** € de cagnotte versés aux clients vs € de flexibilité captés par le pilotage Robin. */
  flex: {
    captured: number
    paid: number
    prevCaptured: number
    prevPaid: number
    capturedSeries: number[]
    paidSeries: number[]
  }
  churnReasons: ChurnReasonData[]
  range: DateRange
  previousRange: DateRange
  days: number
  granularity: 'jour' | 'semaine'
  kpis: {
    mrr: { value: number; previous: number; spark: number[] }
    active: { value: number; previous: number; spark: number[] }
    newCustomers: { value: number; previous: number; spark: number[] }
    churn: { value: number; previous: number; spark: number[] }
    smart: { value: number; previous: number; spark: number[] }
    arpu: { value: number; previous: number; spark: number[] }
  }
  mrrSeries: SeriesPoint[]
  mrrPrevious: number[]
  newSeries: SeriesPoint[]
  newPrevious: number[]
  revenueByOffer: { id: OfferId; label: string; value: number; previous: number }[]
  funnel: FunnelStepData[]
  annotations: Annotation[]
}

const churnRate = (days: DayPoint[]) =>
  (sum(days.map((d) => d.churned)) / (sum(days.map((d) => d.active)) / days.length) / days.length) *
  30.4 *
  100

/** Toutes les données du tableau de bord pour une plage : c'est ce que le PeriodSelector fait varier. */
export function getDashboardData(
  range: DateRange,
  compare: CompareMode = 'previous'
): DashboardData {
  const i0 = Math.max(0, daysBetween(DATA_START, range.from))
  const i1 = Math.min(DAILY.length - 1, daysBetween(DATA_START, range.to))
  const cur = DAILY.slice(i0, i1 + 1)
  const len = cur.length
  const p0 = compare === 'year' ? Math.max(0, i0 - 365) : Math.max(0, i0 - len)
  const prev = DAILY.slice(p0, p0 + len)
  const size = len > 120 ? 7 : 1
  const last = cur[cur.length - 1]!
  const prevLast = prev[prev.length - 1] ?? cur[0]

  const mrrSeries = bucket(cur, size, (d) => d.mrr, 'last')
  const newSeries = bucket(cur, size, (d) => d.newCustomers, 'sum')
  const mrrPrevious = bucket(prev, size, (d) => d.mrr, 'last').map((p) => p.value)
  const newPrevious = bucket(prev, size, (d) => d.newCustomers, 'sum').map((p) => p.value)

  const newSum = sum(cur.map((d) => d.newCustomers))
  const subscriptions = Math.round(newSum / 0.81)
  const simulations = Math.round(subscriptions / 0.094)
  const visits = Math.round(simulations / 0.53)
  const smartOn = Math.round(newSum * 0.74)

  const weekly = bucket(cur, Math.max(1, Math.round(len / 12)), (d) => d.newCustomers, 'sum').map(
    (p) => p.value
  )
  const chunkChurn: number[] = []
  const step = Math.max(1, Math.floor(len / 12))
  for (let i = 0; i < len; i += step) chunkChurn.push(churnRate(cur.slice(i, i + step)))

  return {
    range: { from: cur[0].date, to: last.date },
    previousRange: { from: prev[0]?.date ?? cur[0].date, to: prevLast.date },
    days: len,
    granularity: size > 1 ? 'semaine' : 'jour',
    kpis: {
      mrr: { value: last.mrr, previous: prevLast.mrr, spark: sample(cur.map((d) => d.mrr)) },
      active: {
        value: last.active,
        previous: prevLast.active,
        spark: sample(cur.map((d) => d.active)),
      },
      newCustomers: {
        value: newSum,
        previous: sum(prev.map((d) => d.newCustomers)),
        spark: sample(weekly),
      },
      churn: {
        value: churnRate(cur),
        previous: prev.length ? churnRate(prev) : churnRate(cur),
        spark: sample(chunkChurn),
      },
      smart: {
        value: last.smartRate * 100,
        previous: prevLast.smartRate * 100,
        spark: sample(cur.map((d) => d.smartRate * 100)),
      },
      arpu: {
        value: last.mrr / last.active,
        previous: prevLast.mrr / prevLast.active,
        spark: sample(cur.map((d) => d.mrr / d.active)),
      },
    },
    mrrSeries,
    mrrPrevious,
    newSeries,
    newPrevious,
    revenueByOffer: OFFER_IDS.map((id) => ({
      id,
      label: OFFERS[id].label,
      value: sum(cur.map((d) => d.mrrByOffer[id] / 30.4)),
      previous: sum(prev.map((d) => d.mrrByOffer[id] / 30.4)),
    })),
    funnel: [
      {
        label: 'Visite simulateur',
        value: visits,
        hint: 'Sessions uniques sur le simulateur d’économies',
      },
      { label: 'Simulation', value: simulations, hint: 'Simulation menée jusqu’au résultat' },
      {
        label: 'Souscription',
        value: subscriptions,
        hint: 'Contrat signé en ligne ou via installateur',
      },
      { label: 'Activation Enedis', value: newSum, hint: 'Point de livraison activé par Enedis' },
      { label: 'Mode Smart activé', value: smartOn, hint: 'Robin pilote au moins un équipement' },
    ],
    annotations: EVENTS.filter((e) => e.date >= cur[0].date && e.date <= last.date),
    compare,
    flex: (() => {
      const cap = cur.map(flexCaptured)
      const paid = cur.map(cagnottePaid)
      return {
        captured: sum(cap),
        paid: sum(paid),
        prevCaptured: sum(prev.map(flexCaptured)),
        prevPaid: sum(prev.map(cagnottePaid)),
        capturedSeries: sample(cap, 14),
        paidSeries: sample(paid, 14),
      }
    })(),
    churnReasons: churnReasonsFor(cur),
  }
}

/* ---------- flexibilité vs cagnotte ---------- */
const dayNoise = (date: string) => {
  let h = 0
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) | 0
  return ((h >>> 0) % 1000) / 1000
}
/** Valeur captée par le pilotage (arbitrage prix spot, prix négatifs, capacité) : plus forte en été et les jours de prix négatifs. */
function flexCaptured(d: DayPoint) {
  const m = Number(d.date.slice(5, 7))
  const summer = m >= 4 && m <= 9 ? 1.35 : 0.8
  const negDay = dayNoise(d.date) > 0.86 ? 2.4 : 1
  return d.active * d.smartRate * 0.052 * summer * negDay
}
/** Cagnotte versée aux clients : barème +5 cts/kWh piloté, assez stable. */
function cagnottePaid(d: DayPoint) {
  const m = Number(d.date.slice(5, 7))
  const summer = m >= 4 && m <= 9 ? 1.2 : 0.85
  return d.active * d.smartRate * 0.041 * summer * (0.94 + dayNoise(`${d.date}c`) * 0.12)
}

/* ---------- raisons de résiliation (sondage de départ) ---------- */
export type ChurnReasonData = {
  id: string
  label: string
  count: number
  mrrLost: number
  verbatim?: string
}
const REASONS: { id: string; label: string; share: number; arpu: number; verbatim: string }[] = [
  {
    id: 'demenagement',
    label: 'Déménagement',
    share: 0.29,
    arpu: 28,
    verbatim: '« On vend la maison, les panneaux restent. »',
  },
  {
    id: 'economies',
    label: 'Économies jugées trop faibles',
    share: 0.21,
    arpu: 24,
    verbatim: '« Je ne vois pas la différence sur ma facture. »',
  },
  {
    id: 'robin',
    label: 'Problème coffret Robin',
    share: 0.14,
    arpu: 41,
    verbatim: '« Le coffret se déconnecte toutes les semaines. »',
  },
  {
    id: 'enedis',
    label: 'Mise en service trop longue',
    share: 0.12,
    arpu: 33,
    verbatim: '« Trois semaines sans nouvelles d’Enedis. »',
  },
  {
    id: 'batterie',
    label: 'Passage à une batterie physique',
    share: 0.1,
    arpu: 30,
    verbatim: '« Mon installateur m’a proposé une batterie. »',
  },
  {
    id: 'concurrent',
    label: 'Offre concurrente',
    share: 0.09,
    arpu: 36,
    verbatim: '« Un concurrent m’a fait un meilleur prix du kWh. »',
  },
  { id: 'autre', label: 'Autre / sans réponse', share: 0.05, arpu: 27, verbatim: '' },
]
function churnReasonsFor(days: DayPoint[]): ChurnReasonData[] {
  const churned = sum(days.map((d) => d.churned))
  const robinBoost = days.some((d) => d.date >= '2026-10-05') ? 1.25 : 1
  return REASONS.map((r) => {
    const count = Math.round(churned * r.share * (r.id === 'robin' ? robinBoost : 1))
    return {
      id: r.id,
      label: r.label,
      count,
      mrrLost: count * r.arpu,
      verbatim: r.verbatim || undefined,
    }
  })
}

/* ---------- cohortes ---------- */
export type CohortRow = { cohort: string; size: number; retention: (number | null)[] }

/** 12 cohortes mensuelles (sept. 2025 → août 2026), rétention M1 → M12. Les cohortes post-S21 churnent plus. */
export const COHORTS: CohortRow[] = (() => {
  const rnd = mulberry32(21)
  const rows: CohortRow[] = []
  for (let m = 0; m < 12; m++) {
    const y = 2025 + Math.floor((8 + m) / 12)
    const month = ((8 + m) % 12) + 1
    const cohort = `${y}-${String(month).padStart(2, '0')}-01`
    const size = sum(
      DAILY.filter((d) => d.date.startsWith(cohort.slice(0, 7))).map((d) => d.newCustomers)
    )
    const elapsed = (2026 - y) * 12 + (10 - month) // mois complets écoulés jusqu'à octobre 2026
    const postS21 = cohort >= '2026-06-01' && cohort < '2026-08-01'
    let r = 1
    const retention: (number | null)[] = []
    for (let k = 1; k <= 12; k++) {
      if (k > elapsed) {
        retention.push(null)
        continue
      }
      const c =
        k === 1
          ? (postS21 ? 0.047 : 0.031) + rnd() * 0.006
          : (postS21 ? 0.018 : 0.0125) + (rnd() - 0.5) * 0.004
      r *= 1 - c
      retention.push(r * 100)
    }
    rows.push({ cohort, size, retention })
  }
  return rows
})()

/** Cohortes de rétention segmentées par offre (à la ChartMogul) : ENCORE fidélise mieux, MyBattery moins. */
export const COHORTS_BY_OFFER: Record<OfferId, CohortRow[]> = (() => {
  const factor: Record<OfferId, { size: number; churn: number }> = {
    smartbattery: { size: 0.52, churn: 1 },
    encore: { size: 0.2, churn: 0.7 },
    mybattery: { size: 0.28, churn: 1.35 },
  }
  return Object.fromEntries(
    OFFER_IDS.map((o) => [
      o,
      COHORTS.map((row) => ({
        cohort: row.cohort,
        size: Math.round(row.size * factor[o].size),
        retention: row.retention.map((v) =>
          v === null ? null : 100 - (100 - v) * factor[o].churn
        ),
      })),
    ])
  ) as Record<OfferId, CohortRow[]>
})()

/**
 * Activation du mode Smart par cohorte d'installation : part des foyers de la cohorte avec Robin pilotant
 * au moins un équipement, M1 → M12. La courbe monte (installation, appairage) ; les cohortes récentes ENCORE
 * plafonnent (firmware 4.2).
 */
export const SMART_COHORTS: CohortRow[] = COHORTS.map((row, i) => {
  const recent = i >= 10
  let v = 38 + i * 0.8
  return {
    cohort: row.cohort,
    size: row.size,
    retention: row.retention.map((r, k) => {
      if (r === null) return null
      v = v + (84 - v) * (k === 0 ? 0.42 : 0.33)
      return Math.min(100, recent ? v * 0.88 : v)
    }),
  }
})

/* ---------- comptes clients ---------- */
export type AccountStatus = 'actif' | 'activation' | 'impaye' | 'resilie' | 'suspendu'
export type TimelineEvent = {
  date: string
  label: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}
export type CustomerAccount = {
  id: string
  name: string
  email: string
  city: string
  offer: OfferId
  status: AccountStatus
  mrr: number
  since: string
  kwc: number
  installer: string
  robin: 'en ligne' | 'hors ligne' | 'non installé'
  smart: boolean
  balance: number
  timeline: TimelineEvent[]
}

const FIRST = [
  'Camille',
  'Julien',
  'Sophie',
  'Nicolas',
  'Élodie',
  'Thomas',
  'Claire',
  'Mathieu',
  'Aurélie',
  'Romain',
  'Laura',
  'Antoine',
  'Pauline',
  'Hugo',
  'Céline',
  'Maxime',
  'Isabelle',
  'Lucas',
  'Nathalie',
  'Benoît',
  'Manon',
  'Olivier',
  'Sarah',
  'Damien',
]
const LAST = [
  'Martin',
  'Bernard',
  'Dubois',
  'Robert',
  'Richard',
  'Petit',
  'Durand',
  'Leroy',
  'Moreau',
  'Simon',
  'Laurent',
  'Lefèvre',
  'Michel',
  'Garcia',
  'Roux',
  'Fournier',
  'Girard',
  'Bonnet',
  'Mercier',
  'Blanc',
  'Guérin',
  'Faure',
  'André',
  'Chevalier',
]
const CITIES = [
  'Villeurbanne',
  'Nantes',
  'Montpellier',
  'Toulouse',
  'Rennes',
  'Bordeaux',
  'Annecy',
  'Angers',
  'Perpignan',
  'Valence',
  'Lille',
  'Dijon',
  'Aix-en-Provence',
  'Brest',
  'Grenoble',
  'Pau',
]
const INSTALLERS = [
  'Soleil Rhône Énergie',
  'Breizh PV',
  'Occitanie Solaire',
  'Atlantique Photovoltaïque',
  'Alpes Énergies Vertes',
  'Nord Solaire Pro',
]

export const ACCOUNTS: CustomerAccount[] = (() => {
  const rnd = mulberry32(35)
  const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]
  const out: CustomerAccount[] = []
  for (let i = 0; i < 48; i++) {
    const first = FIRST[(i * 7) % FIRST.length]
    const last = LAST[(i * 11 + 3) % LAST.length]
    const roll = rnd()
    const status: AccountStatus =
      roll < 0.68 ? 'actif' : roll < 0.8 ? 'activation' : roll < 0.89 ? 'impaye' : 'resilie'
    const offerRoll = rnd()
    const offer: OfferId =
      i === 0
        ? 'encore'
        : offerRoll < 0.5
          ? 'smartbattery'
          : offerRoll < 0.72
            ? 'encore'
            : 'mybattery'
    const since = addDays(
      MOCK_TODAY,
      -(status === 'activation' ? 4 + Math.floor(rnd() * 20) : 60 + Math.floor(rnd() * 700))
    )
    const kwc = Math.round((3 + rnd() * 6) * 2) / 2
    const base = OFFERS[offer].arpu * (0.8 + rnd() * 0.45)
    const mrr = status === 'resilie' ? 0 : Math.round(base * 100) / 100
    const robin: CustomerAccount['robin'] =
      status === 'resilie'
        ? 'non installé'
        : rnd() < 0.12
          ? 'hors ligne'
          : status === 'activation'
            ? 'non installé'
            : 'en ligne'
    const smart = status === 'actif' && robin === 'en ligne' && (offer !== 'encore' || rnd() < 0.7)
    const timeline: TimelineEvent[] = [
      {
        date: since,
        label: `Souscription ${OFFERS[offer].label} via ${INSTALLERS[i % INSTALLERS.length]}`,
      },
    ]
    if (status !== 'activation') {
      timeline.push({
        date: addDays(since, 9 + Math.floor(rnd() * 8)),
        label: 'Activation Enedis confirmée',
        tone: 'success',
      })
      timeline.push({ date: addDays(since, 21), label: 'Coffret Robin installé et appairé' })
      if (smart)
        timeline.push({ date: addDays(since, 24), label: 'Mode Smart activé', tone: 'success' })
    } else {
      timeline.push({
        date: addDays(since, 2),
        label: 'Demande de mise en service envoyée à Enedis',
        tone: 'warning',
      })
    }
    if (status === 'impaye')
      timeline.push({
        date: addDays(MOCK_TODAY, -6),
        label: 'Échec de prélèvement SEPA, relance envoyée',
        tone: 'danger',
      })
    if (status === 'resilie')
      timeline.push({
        date: addDays(MOCK_TODAY, -Math.floor(10 + rnd() * 40)),
        label: 'Résiliation (déménagement)',
        tone: 'danger',
      })
    if (offer === 'encore' && status === 'actif' && i % 3 === 0)
      timeline.push({
        date: '2026-10-05',
        label: 'Firmware Robin 4.2 installé, mode Smart interrompu',
        tone: 'warning',
      })
    if (robin === 'hors ligne')
      timeline.push({
        date: addDays(MOCK_TODAY, -1),
        label: 'Coffret Robin hors ligne depuis 26 h',
        tone: 'warning',
      })
    timeline.sort((a, b) => (a.date < b.date ? 1 : -1))
    out.push({
      id: `ML-${String(204_381 + i * 137).padStart(6, '0')}`,
      name: `${first} ${last}`,
      email: `${first}.${last}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '@exemple.fr',
      city: pick(CITIES),
      offer,
      status,
      mrr,
      since,
      kwc,
      installer: INSTALLERS[i % INSTALLERS.length],
      robin,
      smart,
      balance: status === 'impaye' ? -Math.round(mrr * 2 * 100) / 100 : 0,
      timeline,
    })
  }
  return out
})()

/* ---------- alertes ops ---------- */
export type AlertSeverity = 'critique' | 'majeure' | 'mineure'
export type OpsAlert = {
  id: string
  severity: AlertSeverity
  title: string
  detail: string
  source: string
  at: number
}

const NOW = Date.parse('2026-10-12T13:12:00+02:00')
const MIN = 60_000

export const INITIAL_ALERTS: OpsAlert[] = [
  {
    id: 'a1',
    severity: 'critique',
    title: 'Prix spot négatifs demain 12h-16h',
    detail: 'Jusqu’à −18 €/MWh. 8 420 coffrets Robin à basculer en stockage prioritaire.',
    source: 'EPEX Spot',
    at: NOW - 4 * MIN,
  },
  {
    id: 'a2',
    severity: 'majeure',
    title: '312 coffrets Robin hors ligne',
    detail: 'Concentrés sur Lille et Amiens, depuis 14 min. Probable panne opérateur 4G.',
    source: 'Supervision Robin',
    at: NOW - 14 * MIN,
  },
  {
    id: 'a3',
    severity: 'majeure',
    title: '146 mises en service Enedis > 10 jours',
    detail: 'Délai moyen 13,2 j (objectif 8 j). 61 dossiers sur la DR Sud-Ouest.',
    source: 'Flux Enedis SGE',
    at: NOW - 52 * MIN,
  },
  {
    id: 'a4',
    severity: 'mineure',
    title: 'Taux d’échec SEPA en hausse',
    detail: '87 prélèvements rejetés ce matin (0,25 %, habituel 0,15 %).',
    source: 'Paiements',
    at: NOW - 95 * MIN,
  },
  {
    id: 'a5',
    severity: 'mineure',
    title: 'Latence API Linky 2,4 s',
    detail: 'Courbes de charge en retard d’1 h, sans impact client visible.',
    source: 'Plateforme data',
    at: NOW - 140 * MIN,
  },
]

/** Alertes qui « arrivent » en direct dans la démo. */
export const ALERT_POOL: Omit<OpsAlert, 'id' | 'at'>[] = [
  {
    severity: 'majeure',
    title: 'Pic de prix négatifs avancé à 11h',
    detail: 'Prévision RTE révisée : production solaire +9 % vs J-1.',
    source: 'EPEX Spot',
  },
  {
    severity: 'mineure',
    title: '27 coffrets Robin de retour en ligne',
    detail: 'Zone Lille rétablie, 285 encore hors ligne.',
    source: 'Supervision Robin',
  },
  {
    severity: 'critique',
    title: 'Mode Smart interrompu sur 1 120 comptes ENCORE',
    detail: 'Corrélé au firmware Robin 4.2 (déployé le 5 oct.).',
    source: 'Détection d’anomalies',
  },
  {
    severity: 'mineure',
    title: 'Pic de demandes support « cagnotte »',
    detail: '+38 % de tickets depuis l’envoi de la newsletter de 11h.',
    source: 'Support',
  },
  {
    severity: 'majeure',
    title: 'Retard flux de comptage Enedis J-1',
    detail: '4 300 PDL sans index, factures de mi-mois décalées.',
    source: 'Flux Enedis SGE',
  },
]

/* ---------- insight mis en avant ---------- */
export const SMART_ENCORE_SPARK = DAILY.slice(-21).map((d) => d.smartRateEncore * 100)
