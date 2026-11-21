import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class RemindersRun extends BaseCommand {
  static commandName = 'reminders:run'
  static description = 'Send the morning summaries that are due right now (what the scheduler does every 5 minutes)'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { ReminderService } = await import('#services/reminder_service')
    const service = await this.app.container.make(ReminderService)
    const stats = await service.run()
    this.logger.info(JSON.stringify(stats))
  }
}
