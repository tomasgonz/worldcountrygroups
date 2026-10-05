import { getDonors, getAidCuts, getDonorMeta } from '~/server/utils/donors'

/** Donor league table, DAC totals, cuts tracker and data notes. */
export default defineEventHandler(() => {
  const { donors, dac_total, rankings } = getDonors()
  const { cuts, increases, cuts_3y, increases_3y } = getAidCuts()
  return { meta: getDonorMeta(), donors, dac_total, rankings, cuts, increases, cuts_3y, increases_3y }
})
