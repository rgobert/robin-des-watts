import { DemoLiveService } from '#services/demo_live_service'
import { evenementValidator } from '#validators/evenement'
import type { HttpContext } from '@adonisjs/core/http'

export default class EvenementsController {
  async execute(ctx: HttpContext) {
    const { type, props } = await ctx.request.validateUsing(evenementValidator)
    const live = new DemoLiveService()
    live.record(live.profile(ctx), type, props)
    return ctx.response.noContent()
  }
}
