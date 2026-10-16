import { DemoLiveService } from '#services/demo_live_service'
import { FleetSimulationService } from '#services/fleet_simulation_service'
import type { HttpContext } from '@adonisjs/core/http'
import QRCode from 'qrcode'

export default class AdminController {
  async render({ inertia, request }: HttpContext) {
    const protocol = request.header('x-forwarded-proto') ?? request.protocol()
    const demoUrl = `${protocol}://${request.host()}/annee-2`
    const qrSvg = await QRCode.toString(demoUrl, { type: 'svg', margin: 1 })
    return inertia.render('admin', {
      ...new DemoLiveService().dashboard(),
      demoUrl,
      qrSvg,
      fleet: new FleetSimulationService().snapshot(),
    })
  }

  async execute({ response }: HttpContext) {
    new DemoLiveService().reset()
    new FleetSimulationService().reset()
    return response.redirect().back()
  }
}
