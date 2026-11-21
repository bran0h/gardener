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
import { controllers } from '#generated/controllers'

router.get('/health', () => ({ ok: true })).as('health')

router
  .group(() => {
    router.get('key', [controllers.Pushes, 'key']).as('key')
    router.post('test', [controllers.Pushes, 'test']).as('test').use(middleware.supabaseAuth())
  })
  .prefix('/push')
  .as('push')
