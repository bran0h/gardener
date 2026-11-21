import type { ApplicationService } from '@adonisjs/core/types'
import { Cron } from 'croner'

/**
 * Runs the reminder job inside the web server process: every five minutes it
 * sends the morning summaries that are due. Only in the HTTP server (not in
 * ace commands or tests), and only when REMINDERS_ENABLED=true.
 */
export default class ReminderProvider {
  #job: Cron | null = null

  constructor(protected app: ApplicationService) {}

  async ready() {
    if (this.app.getEnvironment() !== 'web') return
    const env = (await import('#start/env')).default
    if (!env.get('REMINDERS_ENABLED')) return

    const { ReminderService } = await import('#services/reminder_service')
    const logger = await this.app.container.make('logger')
    const pattern = env.get('REMINDERS_CRON') ?? '*/5 * * * *'

    // protect: a slow run is never overlapped by the next one.
    this.#job = new Cron(pattern, { protect: true, catch: (e) => logger.error(e, 'reminder run failed') }, async () => {
      const service = await this.app.container.make(ReminderService)
      await service.run()
    })
    logger.info({ pattern }, 'reminder job scheduled')
  }

  async shutdown() {
    this.#job?.stop()
  }
}
