import { missions } from '~/server/utils/un-missions'

/** Permanent Representatives and Observers in New York (UN Blue Book). */
export default defineEventHandler(() => missions() || { missions: [] })
