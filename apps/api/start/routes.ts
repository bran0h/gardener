/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import { stat } from 'node:fs/promises'
import { controllers } from '#generated/controllers'

/**
 * Liveness plus two heartbeats the outside monitor checks: the reminder job's
 * last run (in this process) and the last good backup (a file the nightly
 * backup on the host touches, mounted read-only at /run/heartbeats).
 */
router
  .get('/health', async () => {
    const { ReminderService } = await import('#services/reminder_service')
    const backup = await stat('/run/heartbeats/backup-ok').catch(() => null)
    return {
      ok: true,
      remindersLastRunAt: ReminderService.lastRunAt?.toISOString() ?? null,
      backupLastOkAt: backup?.mtime.toISOString() ?? null,
    }
  })
  .as('health')

router
  .group(() => {
    router.get('key', [controllers.Pushes, 'key']).as('key')
    router.post('test', [controllers.Pushes, 'test']).as('test').use(middleware.supabaseAuth())
  })
  .prefix('/push')
  .as('push')
