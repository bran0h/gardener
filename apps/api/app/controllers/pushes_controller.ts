import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { ReminderService } from '#services/reminder_service'
import { testPushValidator } from '#validators/push'

export default class PushesController {
  /** The VAPID public key a browser needs to subscribe. */
  key() {
    return { publicKey: env.get('VAPID_PUBLIC_KEY') }
  }

  /** Sends today's summary (or a hello) to the caller's device(s) right now. */
  @inject()
  async test({ request, response, caller }: HttpContext, reminders: ReminderService) {
    const { endpoint } = await request.validateUsing(testPushValidator)
    const result = await reminders.sendNow(caller.id, endpoint)
    if (!result.devices) {
      return response.notFound({ error: 'This device has not turned reminders on yet.' })
    }
    return result
  }
}
