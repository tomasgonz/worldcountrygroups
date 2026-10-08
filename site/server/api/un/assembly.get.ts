import { gaVotes, gaCommittees, ecosoc } from '~/server/utils/ga-assembly'

/** The General Assembly (votes, committees, plenary) and ECOSOC. */
export default defineEventHandler(() => ({ votes: gaVotes(), assembly: gaCommittees(), ecosoc: ecosoc() }))
