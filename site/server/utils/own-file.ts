import { chownSync, statSync } from 'fs'
import { dirname } from 'path'

/** Give a file written by the server (root) to the owner of its folder, so jobs and backups running as that user can read it. */
export function ownLikeFolder(file: string) {
  try { const st = statSync(dirname(file)); chownSync(file, st.uid, st.gid) } catch {}
}
