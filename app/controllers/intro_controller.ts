import { DemoLiveService, slideParam } from '#services/demo_live_service'
import { SimulationService } from '#services/simulation_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class IntroController {
  async render(ctx: HttpContext) {
    const live = new DemoLiveService()
    const profile = live.profile(ctx)
    live.sharedLinkOpened(ctx, profile)
    return ctx.inertia.render('intro', {
      ...new SimulationService().retro(),
      profile,
      startSlide: slideParam(ctx.request.input('slide')),
    })
  }
}
