import { cpSync, existsSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const studioDir = resolve(here, '../..')

/** The only directory this module ever writes to or deletes from. */
export const SCRATCH_ROOT = join(realpathSync(tmpdir()), 'q2-studio-e2e')

const MARKER = '.q2-studio-e2e-scratch'
/** The real kit, read-only source: the scratch copy is made per reset, so no second copy is kept. */
const KIT_TEMPLATES = join(studioDir, '../news/_templates')
const FIXTURE_NEWS = join(here, '../fixtures/scratch-repo/news')

/** Wipes the scratch `news/` and re-copies the fixture. Refuses any root but `SCRATCH_ROOT`. */
export function resetScratch(root: string = SCRATCH_ROOT): void {
  if (resolve(root) !== SCRATCH_ROOT) {
    throw new Error(`resetScratch refuses ${root}: only ${SCRATCH_ROOT} may be reset`)
  }
  mkdirSync(join(root, 'studio'), { recursive: true })
  writeFileSync(join(root, MARKER), '')
  cpSync(join(studioDir, 'launcher-core.lock.json'), join(root, 'studio/launcher-core.lock.json'))
  rmSync(join(root, 'news'), { recursive: true, force: true })
  cpSync(FIXTURE_NEWS, join(root, 'news'), { recursive: true })
  cpSync(KIT_TEMPLATES, join(root, 'news/_templates'), { recursive: true })
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  resetScratch()
  if (!existsSync(join(SCRATCH_ROOT, MARKER))) throw new Error('scratch root not prepared')
}
