/*
 * Données fictives du scénario B2B : SolEnergie Rhône, installateur partenaire mylight150 à Lyon.
 * Noms inventés, communes du Rhône réelles, numéros dans la plage ARCEP réservée à la fiction (06 39 98 xx xx).
 * Les dates sont calculées par rapport au moment du chargement : la démo reste crédible quel que soit le jour.
 */
import type { ActivityEntry } from './activity_feed'
import type { FleetClient } from './fleet_cockpit'
import type { ProposalOption } from './interactive_proposal'
import type { PipelineStep } from './status_pipeline'

export type DossierStage = 'devis' | 'pose' | 'enedis' | 'mes' | 'bv'
export type ProOffer = 'MySmartBattery' | 'MyBattery' | 'ENCORE'

export type Dossier = {
  id: string
  ref: string
  client: string
  commune: string
  postcode: string
  phone: string
  email: string
  kwc: number
  kva: number
  offer: ProOffer
  stage: DossierStage
  late?: { days: number; reason: string }
  owner: string
  updatedAt: string
  equipment: string[]
}

export const INSTALLER = {
  name: 'SolEnergie Rhône',
  city: 'Lyon 7e',
  contact: '04 78 00 00 00',
  user: 'Karim Benali',
}
export const TEAM = ['Karim Benali', 'Léa Vidal', 'Yanis Ferrand'] as const

export const STAGES: { id: DossierStage; label: string; estimate: string }[] = [
  { id: 'devis', label: 'Devis signé', estimate: 'Attente signature' },
  { id: 'pose', label: 'Pose Robin', estimate: 'Sous 2 à 3 sem.' },
  { id: 'enedis', label: 'Demande Enedis', estimate: '4 à 6 sem.' },
  { id: 'mes', label: 'Mise en service', estimate: '≈ 1 sem.' },
  { id: 'bv', label: 'Batterie virtuelle activée', estimate: 'Sous 48 h' },
]
export const stageLabel = (s: DossierStage) => STAGES.find((x) => x.id === s)!.label
export const stageIndex = (s: DossierStage) => STAGES.findIndex((x) => x.id === s)

export const OFFERS: { id: ProOffer; label: string }[] = [
  { id: 'MySmartBattery', label: 'MySmartBattery' },
  { id: 'MyBattery', label: 'MyBattery' },
  { id: 'ENCORE', label: 'ENCORE' },
]

const MIN = 60_000
const DAY = 86_400_000
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const short = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

type Seed = [
  client: string,
  commune: string,
  postcode: string,
  kwc: number,
  kva: number,
  offer: ProOffer,
  stage: DossierStage,
  owner: number,
  updatedMin: number,
  late?: Dossier['late'],
]

const SEEDS: Seed[] = [
  [
    'Julien Moreau',
    'Villeurbanne',
    '69100',
    6,
    9,
    'MySmartBattery',
    'enedis',
    1,
    38,
    {
      days: 12,
      reason:
        'Demande de raccordement sans réponse d’Enedis depuis 6 semaines (délai habituel : 4). Relance recommandée avec le numéro d’affaire.',
    },
  ],
  ['Sophie Lefèvre', 'Caluire-et-Cuire', '69300', 4.5, 6, 'MySmartBattery', 'bv', 0, 95],
  ['Nicolas Girard', 'Bron', '69500', 9, 12, 'MyBattery', 'pose', 2, 140],
  ['Camille Roux', 'Écully', '69130', 6, 9, 'MySmartBattery', 'devis', 0, 12],
  ['Thomas Fournier', 'Vénissieux', '69200', 3, 6, 'ENCORE', 'mes', 2, 260],
  [
    'Émilie Lambert',
    'Tassin-la-Demi-Lune',
    '69160',
    7.5,
    9,
    'MySmartBattery',
    'enedis',
    1,
    1500,
    {
      days: 8,
      reason:
        'Enedis attend l’attestation Consuel : pièce déposée, validation en cours. Sans retour vendredi, appeler le service raccordement.',
    },
  ],
  ['Antoine Bonnet', 'Meyzieu', '69330', 5, 9, 'MyBattery', 'enedis', 1, 1700],
  ['Claire Mercier', 'Villefranche-sur-Saône', '69400', 9, 12, 'MySmartBattery', 'bv', 0, 2900],
  ['Mathieu Dupuis', 'Rillieux-la-Pape', '69140', 4, 6, 'ENCORE', 'pose', 2, 3100],
  ['Laura Fontaine', 'Oullins', '69600', 6, 9, 'MySmartBattery', 'mes', 2, 4300],
  ['Pierre Chevalier', 'Saint-Priest', '69800', 8, 12, 'MyBattery', 'devis', 0, 4700],
  ['Céline Garnier', 'Brignais', '69530', 3, 6, 'MySmartBattery', 'pose', 2, 5800],
  ['Julie Faure', 'Décines-Charpieu', '69150', 6, 9, 'MySmartBattery', 'enedis', 1, 7200],
  ['Maxime André', 'Craponne', '69290', 4.5, 6, 'ENCORE', 'bv', 0, 8600],
  ['Sandrine Blanc', 'Limonest', '69760', 9, 12, 'MySmartBattery', 'mes', 2, 10100],
  ['Olivier Guérin', 'Givors', '69700', 5, 9, 'MyBattery', 'enedis', 1, 11500],
  ['Aurélie Perrin', 'Mornant', '69440', 7, 9, 'MySmartBattery', 'pose', 2, 12900],
  ['Hugo Marchand', 'Anse', '69480', 3, 6, 'MySmartBattery', 'devis', 0, 14400],
]

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '.')

const equipmentFor = (kwc: number, i: number) => {
  const eq = ['Coffret Robin', 'Chauffe-eau piloté']
  if (kwc >= 6 || i % 3 === 0) eq.push('Pompe à chaleur')
  if (kwc >= 7.5 || i % 4 === 1) eq.push('Borne de recharge')
  return eq
}

export const DOSSIERS: Dossier[] = SEEDS.map(
  ([client, commune, postcode, kwc, kva, offer, stage, owner, updatedMin, late], i) => ({
    id: `d${i + 1}`,
    ref: `SER-26-${String(412 + i * 7).padStart(4, '0')}`,
    client,
    commune,
    postcode,
    phone: `06 39 98 ${String(10 + i * 4).padStart(2, '0')} ${String(21 + i * 3).padStart(2, '0')}`,
    email: `${slug(client)}@example.com`,
    kwc,
    kva,
    offer,
    stage,
    late,
    owner: TEAM[owner],
    updatedAt: ago(updatedMin * MIN),
    equipment: equipmentFor(kwc, i),
  })
)

/** Étapes du pipeline avec dates (réalisées ou prévues) pour un dossier. */
export function stepsFor(d: Dossier): PipelineStep[] {
  const cur = stageIndex(d.stage)
  // Chaque étape passée a pris ~12 jours ; la courante a commencé il y a (retard + 10) jours.
  const startCurrent = Date.now() - ((d.late?.days ?? 0) + 10) * DAY
  return STAGES.map((s, i) => {
    const date = new Date(startCurrent - (cur - i) * 12 * DAY)
    const planned = new Date(Date.now() + (i - cur) * 12 * DAY)
    return {
      id: s.id,
      label: s.label,
      estimate: i === cur ? s.estimate : undefined,
      date: i < cur ? short(date) : i > cur ? `prévu ${short(planned)}` : undefined,
    }
  })
}

export function nextActionFor(d: Dossier) {
  switch (d.stage) {
    case 'devis':
      return {
        label: 'Relancer le client pour la signature du devis',
        owner: d.owner,
        due: 'aujourd’hui',
        ctaLabel: 'Relancer le client',
      }
    case 'pose':
      return {
        label: 'Poser le coffret Robin et raccorder le chauffe-eau',
        owner: 'Yanis Ferrand',
        due: 'jeudi, 8 h 30',
        ctaLabel: 'Confirmer le créneau',
      }
    case 'enedis':
      return d.late
        ? {
            label: 'Relancer Enedis sur la demande de raccordement',
            owner: d.owner,
            due: 'avant vendredi',
            ctaLabel: 'Relancer Enedis',
          }
        : {
            label: 'Suivre la demande de raccordement Enedis',
            owner: d.owner,
            due: 'point vendredi',
            ctaLabel: 'Noter un suivi',
          }
    case 'mes':
      return {
        label: 'Planifier la mise en service avec le client',
        owner: 'Yanis Ferrand',
        due: 'cette semaine',
        ctaLabel: 'Proposer 3 créneaux',
      }
    case 'bv':
      return {
        label: 'Vérifier l’activation de la batterie virtuelle',
        owner: 'Support partenaires mylight150',
        due: 'sous 48 h',
        ctaLabel: 'Prévenir le client',
      }
  }
}

export function etaFor(d: Dossier) {
  const remaining = STAGES.length - 1 - stageIndex(d.stage)
  const end = new Date(Date.now() + (remaining * 12 + (d.late ? 6 : 2)) * DAY)
  return `Batterie virtuelle active vers le ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
}

/** Historique crédible d'un dossier, du devis à l'étape courante. */
export function activityFor(d: Dossier): ActivityEntry[] {
  const cur = stageIndex(d.stage)
  const out: ActivityEntry[] = []
  const at = (minAgo: number) => ago(minAgo * MIN)
  const first = d.client.split(' ')[0]
  const base = ((d.late?.days ?? 0) + 10) * 1440
  out.push({
    id: `${d.id}-a0`,
    at: at(base + cur * 12 * 1440 + 300),
    actor: { name: d.owner, kind: 'installer' },
    action: `a créé le dossier et envoyé le devis (${String(d.kwc).replace('.', ',')} kWc, ${d.offer})`,
  })
  if (cur >= 1) {
    out.push({
      id: `${d.id}-a1`,
      at: at(base + (cur - 1) * 12 * 1440 + 200),
      actor: { name: d.client, kind: 'client' },
      action: `a signé le devis en ligne`,
      tone: 'success',
    })
  }
  if (cur >= 2) {
    out.push({
      id: `${d.id}-a2`,
      at: at(base + (cur - 2) * 12 * 1440 + 90),
      actor: { name: 'Yanis Ferrand', kind: 'installer' },
      action: `a posé le coffret Robin`,
      detail: `4 photos ajoutées · chauffe-eau raccordé${d.equipment.includes('Pompe à chaleur') ? ', PAC reconnue' : ''}`,
      tone: 'success',
    })
    out.push({
      id: `${d.id}-a3`,
      at: at(base + (cur - 2) * 12 * 1440 + 30),
      actor: { name: d.owner, kind: 'installer' },
      action: `a déposé la demande de raccordement Enedis`,
    })
  }
  if (cur >= 3) {
    out.push({
      id: `${d.id}-a4`,
      at: at(base + (cur - 3) * 12 * 1440 + 600),
      actor: { name: 'Enedis', kind: 'enedis' },
      action: `a validé le raccordement`,
      tone: 'success',
    })
  }
  if (cur >= 4) {
    out.push({
      id: `${d.id}-a5`,
      at: at(base + 400),
      actor: { name: 'Yanis Ferrand', kind: 'installer' },
      action: `a effectué la mise en service`,
      detail: `Production relevée : ${(d.kwc * 0.62).toFixed(1).replace('.', ',')} kW à 11 h 40`,
      tone: 'success',
    })
    out.push({
      id: `${d.id}-a6`,
      at: at(180),
      actor: { name: 'mylight150', kind: 'mylight' },
      action: `a lancé l’activation de la batterie virtuelle`,
    })
  }
  if (d.late) {
    out.push({
      id: `${d.id}-l1`,
      at: at(d.late.days * 1440 - 200),
      actor: { name: 'Système', kind: 'system' },
      action: `a signalé un dépassement du délai habituel`,
      tone: 'danger',
    })
    out.push({
      id: `${d.id}-l2`,
      at: at(2 * 1440 + 75),
      actor: { name: d.owner, kind: 'installer' },
      action: `a relancé Enedis par e-mail`,
      detail: `« Bonjour, pouvez-vous nous indiquer l’état d’avancement de la demande ${d.ref} ? »`,
    })
    out.push({
      id: `${d.id}-l3`,
      at: at(1440 + 30),
      actor: { name: d.client, kind: 'client' },
      action: `a demandé où en est son dossier`,
      detail: `Appel entrant · ${first} souhaite une date de mise en service`,
      tone: 'warning',
    })
    out.push({
      id: `${d.id}-l4`,
      at: at(52),
      actor: { name: 'Léa Vidal', kind: 'installer' },
      action: `a ajouté une note`,
      detail: `Consuel OK de notre côté, j’appelle le service raccordement demain matin.`,
    })
  }
  return out
}

/** Estimation simple pour la démo : ≈ 206 € d'économies par kWc et par an (1 237 € pour 6 kWc, moyenne affichée par mylight150). */
export function quoteFor(d: Dossier) {
  const big = d.kwc >= 6
  const production = Math.round(d.kwc * 1250)
  return {
    client: { name: d.client, address: `${d.postcode} ${d.commune}` },
    reference: `Proposition ${d.ref}`,
    equipment: [
      {
        label: `Installation photovoltaïque ${String(d.kwc).replace('.', ',')} kWc`,
        detail: `Compteur ${d.kva} kVA · production estimée ${production.toLocaleString('fr-FR')} kWh/an`,
      },
      {
        label: 'Coffret de pilotage Robin',
        detail: 'Posé et paramétré par SolEnergie Rhône',
        qty: 1,
      },
      ...d.equipment
        .filter((e) => e !== 'Coffret Robin')
        .map((e) => ({ label: e, detail: 'Piloté par Robin aux heures de production' })),
    ],
    offer: big
      ? {
          name: 'MySmartBattery 300',
          monthly: 35.99,
          reason: `Avec ${String(d.kwc).replace('.', ',')} kWc, votre surplus d’été dépasse 250 kWh : la taille 100 en perdrait une partie.`,
          included: [
            '300 kWh de stockage virtuel',
            '1 kWh stocké = 1 kWh restitué',
            'Pilotage Robin inclus',
          ],
        }
      : {
          name: 'MySmartBattery 100',
          monthly: 21.99,
          reason: `Votre surplus estimé tient dans 100 kWh : inutile de payer une taille au-dessus.`,
          included: [
            '100 kWh de stockage virtuel',
            '1 kWh stocké = 1 kWh restitué',
            'Pilotage Robin inclus',
          ],
        },
    savings: {
      yearly: Math.round(d.kwc * 206),
      hypotheses: [
        {
          label: 'Production annuelle (Rhône)',
          value: `${production.toLocaleString('fr-FR')} kWh`,
        },
        { label: 'Autoconsommation avec Robin', value: '≈ 70 %' },
        { label: 'Surplus stocké puis restitué', value: big ? '≈ 280 kWh' : '≈ 90 kWh' },
      ],
      source:
        'Estimation mockée pour la démo · ratio moyen affiché par mylight150 (1 237 €/an pour 6 kWc)',
    },
  }
}

/* ---------- Parc installé (P19) : 24 foyers déjà équipés de Robin ---------- */

type FleetSeed = [
  name: string,
  commune: string,
  issue: FleetClient['issue'],
  sinceDays: number,
  reward: number,
  loss: number,
  detail?: string,
]
const FLEET_SEEDS: FleetSeed[] = [
  ['Nathalie Rousseau', 'Lyon 8e', 'robin_offline', 6, 212, 34, 'dernier signal mardi 21 h'],
  [
    'François Legrand',
    'Sainte-Foy-lès-Lyon',
    'robin_offline',
    3,
    288,
    41,
    'box internet changée ?',
  ],
  ['Isabelle Morel', 'Chassieu', 'activation_late', 9, 0, 28, 'batterie virtuelle non activée'],
  ['Stéphane Lemoine', 'Genas', 'smart_off', 14, 156, 22, 'désactivé depuis l’app'],
  ['Valérie Henry', 'Francheville', 'smart_off', 21, 98, 19],
  ['David Roche', 'Saint-Genis-Laval', 'smart_off', 8, 241, 25, 'désactivé pendant les vacances'],
  ['Caroline Gauthier', 'Neuville-sur-Saône', 'reward_zero', 33, 0, 16, 'chauffe-eau non reconnu'],
  ['Sébastien Muller', 'Charbonnières-les-Bains', 'reward_zero', 41, 0, 14],
  ['Patricia Lucas', 'Lyon 5e', 'ok', 0, 342, 0],
  ['Laurent Fabre', 'Villeurbanne', 'ok', 0, 418, 0],
  ['Christine Dumont', 'Bron', 'ok', 0, 297, 0],
  ['Éric Barbier', 'Écully', 'ok', 0, 365, 0],
  ['Martine Arnaud', 'Caluire-et-Cuire', 'ok', 0, 274, 0],
  ['Philippe Colin', 'Dardilly', 'ok', 0, 451, 0],
  ['Sylvie Giraud', 'Champagne-au-Mont-d’Or', 'ok', 0, 318, 0],
  ['Alain Brun', 'Vaulx-en-Velin', 'ok', 0, 236, 0],
  ['Nadia Haddad', 'Saint-Fons', 'ok', 0, 289, 0],
  ['Vincent Renaud', 'Pierre-Bénite', 'ok', 0, 402, 0],
  ['Anne Picard', 'Irigny', 'ok', 0, 331, 0],
  ['Bruno Lacroix', 'Chaponost', 'ok', 0, 377, 0],
  ['Hélène Roy', 'Sathonay-Camp', 'ok', 0, 263, 0],
  ['Marc Noël', 'Fontaines-sur-Saône', 'ok', 0, 305, 0],
  ['Karine Meunier', 'Collonges-au-Mont-d’Or', 'ok', 0, 348, 0],
  ['Thierry Dufour', 'Saint-Didier-au-Mont-d’Or', 'ok', 0, 392, 0],
]

export const FLEET: FleetClient[] = FLEET_SEEDS.map(
  ([name, commune, issue, sinceDays, rewardYear, lossPerMonth, detail], i) => ({
    id: `f${i + 1}`,
    name,
    commune,
    issue,
    since: ago(sinceDays * DAY),
    detail,
    rewardYear,
    lossPerMonth,
  })
)

/* ---------- Proposition interactive (P18) : Camille Roux, Écully, 6 kWc ---------- */

export const PROPOSAL_OPTIONS: ProposalOption[] = [
  {
    id: 'msb',
    name: 'MySmartBattery 300',
    tagline: '300 kWh de stockage virtuel, 1 kWh stocké = 1 kWh restitué',
    monthly: 35.99,
    savingsYear: 1237,
    solarShare: 74,
    rewardYear: 350,
    highlights: [
      'Surplus d’été gardé pour l’hiver',
      'Pilotage Robin du chauffe-eau et de la PAC',
      'Taille modifiable chaque année',
      'Sans engagement de durée',
    ],
    recommendedReason:
      'votre surplus de juin à août dépasse 250 kWh, la taille 100 en perdrait une partie.',
  },
  {
    id: 'myb',
    name: 'MyBattery',
    tagline: 'Stockage illimité, restitution facturée au kWh',
    monthly: 11.4,
    monthlyNote: '+ 0,11 € par kWh restitué',
    savingsYear: 1058,
    solarShare: 78,
    rewardYear: 350,
    highlights: [
      'Aucun plafond de stockage',
      'Abonnement plus bas',
      'Pilotage Robin inclus',
      'Sans engagement de durée',
    ],
  },
  {
    id: 'encore',
    name: 'ENCORE',
    tagline: 'Offre selon éligibilité (chiffres de démo)',
    monthly: 29.9,
    savingsYear: 980,
    solarShare: 70,
    rewardYear: 290,
    highlights: ['Conditions à confirmer avec votre installateur', 'Pilotage Robin inclus'],
  },
]
