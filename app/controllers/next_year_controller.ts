import { DemoLiveService } from '#services/demo_live_service'
import { SimulationService } from '#services/simulation_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class NextYearController {
  async render(ctx: HttpContext) {
    const profile = new DemoLiveService().profile(ctx)
    return ctx.inertia.render('next_year', { ...new SimulationService().nextYear(), profile })
  }

  async execute(ctx: HttpContext) {
    const live = new DemoLiveService()
    const gain = new SimulationService().smartPilotGainEur()
    live.record(live.profile(ctx), 'activation_demandee', { levier: 'msp', gain_eur_an: gain })
    return ctx.response.redirect().back()
  }
}
