import vine from '@vinejs/vine'
import { EVENT_TYPES } from '#services/demo_live_service'

/**
 * Tracking event sent by the front.
 */
export const evenementValidator = vine.create({
  type: vine.enum(EVENT_TYPES),
  props: vine
    .record(vine.unionOfTypes([vine.string().maxLength(40), vine.number(), vine.boolean()]))
    .optional(),
})
