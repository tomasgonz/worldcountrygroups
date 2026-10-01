import { execFile } from 'child_process'
import { promisify } from 'util'

/** Unix user that owns the project and its Python packages (pdfplumber, openai, ...). */
export const SCRIPT_USER = process.env.WCG_SCRIPT_USER || 'exedev'

/**
 * Command + args to run a Python script as SCRIPT_USER. The service runs as root,
 * but the data files and Python packages belong to SCRIPT_USER, so scripts must
 * run as that user to keep file ownership consistent with the cron jobs.
 */
export function pythonCommand(script: string, args: string[] = []): [string, string[]] {
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0
  return isRoot
    ? ['/usr/sbin/runuser', ['-u', SCRIPT_USER, '--', '/usr/bin/python3', script, ...args]]
    : ['/usr/bin/python3', [script, ...args]]
}

export async function runPython(script: string, args: string[], opts: { timeout?: number; maxBuffer?: number } = {}) {
  const [cmd, argv] = pythonCommand(script, args)
  return promisify(execFile)(cmd, argv, { timeout: opts.timeout ?? 120_000, maxBuffer: opts.maxBuffer ?? 16 * 1024 * 1024 })
}
