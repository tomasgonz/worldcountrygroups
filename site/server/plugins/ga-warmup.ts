import { gaVotes } from '~/server/utils/ga-assembly'

/** Compute the General Assembly vote analysis once after start-up, so the first visitor does not wait. */
export default defineNitroPlugin(() => {
  setTimeout(() => { try { gaVotes() } catch {} }, 20_000)
})
