import * as webpush from 'web-push'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

/** 'gone' means the device unsubscribed or the subscription expired: forget it. */
export type SendResult = 'ok' | 'gone' | 'error'

export class PushSenderService {
  static #configured = false

  #setup() {
    if (PushSenderService.#configured) return
    webpush.setVapidDetails(
      env.get('VAPID_SUBJECT'),
      env.get('VAPID_PUBLIC_KEY'),
      env.get('VAPID_PRIVATE_KEY').release()
    )
    PushSenderService.#configured = true
  }

  async send(
    sub: { endpoint: string; p256dh: string; auth: string },
    payload: PushPayload
  ): Promise<SendResult> {
    this.#setup()
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        // A morning summary is stale by the afternoon.
        { TTL: 60 * 60 * 6, urgency: 'normal' }
      )
      return 'ok'
    } catch (error) {
      const { statusCode: status, body, message } = error as {
        statusCode?: number
        body?: string
        message?: string
      }
      if (status === 404 || status === 410) return 'gone'
      logger.warn({ status, body, reason: message, host: new URL(sub.endpoint).host }, 'push failed')
      return 'error'
    }
  }
}
