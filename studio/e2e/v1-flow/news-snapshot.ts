import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Sorted `relative/path -> sha256` map of every file under `dir`. */
export function snapshotTree(dir: string): Record<string, string> {
  const entries: [string, string][] = []
  const walk = (rel: string): void => {
    for (const d of readdirSync(join(dir, rel), { withFileTypes: true })) {
      const next = rel === '' ? d.name : `${rel}/${d.name}`
      if (d.isDirectory()) walk(next)
      else
        entries.push([
          next,
          createHash('sha256')
            .update(readFileSync(join(dir, next)))
            .digest('hex'),
        ])
    }
  }
  walk('')
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return Object.fromEntries(entries)
}
