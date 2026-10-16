import claire from '../data/claire-martin.json' with { type: 'json' }

/**
 * "Mon année 2" engine. The 24 scenarios are precomputed from the 15-min
 * curve (35 040 steps, 2026) of the organizers’ fictional dataset into app/data/.
 * Guardrail: anniversaryYear (retro) and projection2026 (simulator) are two
 * universes, never shown side by side. The simulator only shows deltas.
 */
export type Capacity = 20 | 100 | 300

export type Levers = {
  smartPilot: boolean
  heaterAtNoon: boolean
  appliancesShifted: boolean
  capacity: Capacity
}

export const BASELINE: Levers = {
  smartPilot: false,
  heaterAtNoon: false,
  appliancesShifted: false,
  capacity: 100,
}

const { anniversaryYear, projection2026 } = claire

export class SimulationService {
  retro() {
    const { retro, totals, co2, rates, days } = anniversaryYear
    return {
      firstName: claire.client.firstName,
      priceHikeEur: retro.priceHike.annualCostOnGridImport,
      rewardPotentialEur: retro.rewardCompensatesHike.reward,
      zeroGridDays: retro.zeroGridDays.count,
      longestStreak: retro.zeroGridDays.longestStreak,
      recordDay: retro.recordProductionDay,
      recordSavingsDay: retro.recordSavingsDay,
      virtualBatteryNetEur: retro.virtualBatteryVsOA.netValue,
      surplusResaleEur: retro.virtualBatteryVsOA.oaRevenueAt1_1c,
      productionKwh: totals.production,
      selfConsumptionRate: rates.selfConsumptionRate,
      autonomyRate: rates.autonomyRate,
      co2: { avoidedKg: co2.avoidedKg, carKm: co2.carKmEquivalent, trees: co2.treesYearEquivalent },
      /** One entry per day of the anniversary year, for the year calendar. */
      days: days.map((d) => ({
        date: d.date,
        productionKwh: d.production,
        savingsEur: d.savings,
        zeroGrid: d.gridImport === 0,
      })),
    }
  }

  /** Server-side source of the MSP gain, used by the activation event. */
  smartPilotGainEur() {
    return projection2026.ranking.find((r) => r.id === 'msp')?.gainEur ?? 0
  }

  nextYear() {
    return {
      label: 'Projeté sur votre profil 2026',
      priceHikeEur: projection2026.priceHike.annualCostOnGridImport,
      baseline: BASELINE,
      scenarios: projection2026.scenarios.map((s) => ({
        levers: {
          smartPilot: s.msp,
          heaterAtNoon: s.moveWaterHeaterToMidday,
          appliancesShifted: s.moveAppliancesToMidday,
          capacity: s.capacity as Capacity,
        },
        gainEur: s.delta.gainEur,
        gridImportKwh: s.delta.gridImportKwh,
        selfConsumedKwh: s.delta.selfConsumedKwh,
      })),
      ranking: projection2026.ranking.map((r) => ({
        id: r.id,
        label: r.label,
        gainEur: r.gainEur,
        effort: r.effort,
      })),
    }
  }
}
