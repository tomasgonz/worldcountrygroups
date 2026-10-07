import { leadership } from '~/server/utils/un-leadership'

/** UN principals and senior officials: holders and recent statements. */
export default defineEventHandler(() => leadership() || { offices: [] })
