/*
 * Banque de faits « Le saviez-vous ? » pour les moments d'attente.
 * Sources : site mylight150 et données marché, relevé du 08/10/2026.
 * Règle : un fait = un chiffre vérifiable + une source. Revalider avec la data client du jour J.
 */
export type FactKind = 'solar' | 'battery' | 'grid' | 'reward' | 'tip'

export type Fact = {
  text: string
  source?: string
  kind?: FactKind
}

export const ENERGY_FACTS: Fact[] = [
  {
    kind: 'solar',
    text: 'Sans pilotage, un foyer ne consomme en direct que 30 à 40 % de ce que produisent ses panneaux.',
    source: 'mylight150.com',
  },
  {
    kind: 'grid',
    text: "Depuis juin 2026, le surplus injecté sur le réseau n'est racheté que 1,1 centime le kWh.",
    source: 'Arrêté S21, 2026',
  },
  {
    kind: 'tip',
    text: "D'avril à octobre, des heures creuses peuvent tomber entre 11h et 17h : le meilleur moment pour lancer la machine.",
    source: 'Offres réglementées, depuis nov. 2025',
  },
  {
    kind: 'grid',
    text: "Au 1er semestre 2026, l'électricité a eu un prix négatif pendant 408 heures en France.",
    source: 'Données marché S1 2026',
  },
  {
    kind: 'reward',
    text: 'Un chauffe-eau piloté rapporte environ 100 € par an à la cagnotte, une pompe à chaleur environ 250 €.',
    source: 'Barème cagnotte mylight150',
  },
  {
    kind: 'battery',
    text: 'Avec la batterie virtuelle, 1 kWh stocké l’été peut être récupéré l’hiver.',
    source: 'Offre MySmartBattery',
  },
  {
    kind: 'grid',
    text: "Taxes et frais de réseau représentent plus de la moitié d'une facture d'électricité.",
    source: 'mylight150.com',
  },
]

export const QUIZ: Array<{ q: string; answer: boolean; explain: string }> = [
  {
    q: 'Vendre son surplus au réseau, ça rapporte plus que de le consommer.',
    answer: false,
    explain:
      'Le rachat est à 1,1 c€/kWh, le kWh acheté coûte environ 19 c€. Mieux vaut le consommer ou le stocker.',
  },
  {
    q: 'Le meilleur moment pour chauffer l’eau, c’est autour de midi.',
    answer: true,
    explain: 'C’est le pic de production solaire : l’énergie est gratuite chez vous.',
  },
  {
    q: 'La batterie virtuelle est une batterie installée dans votre garage.',
    answer: false,
    explain: 'C’est un crédit de kWh gardé pour vous, sans équipement à installer.',
  },
]
