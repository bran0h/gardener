import vine from '@vinejs/vine'

/** POST /push/test: optionally target only the device asking. */
export const testPushValidator = vine.compile(
  vine.object({
    endpoint: vine.string().url().maxLength(1000).optional(),
  })
)
