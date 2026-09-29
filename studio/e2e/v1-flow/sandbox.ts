/** Throwaway repository for the v1 flow: fixture news, the real kit, registry dirs. Never inside the repo. */
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { SCRATCH_MARKER } from '../../src/bridge/scratch-repo-root'

export interface FlowSandbox {
  readonly root: string
  readonly cleanup: () => void
}

const REGISTRY_DIRS = ['engines', 'gamedata', 'packs', 'mods', 'config_templates'] as const

export function createFlowSandbox(repoRoot: string): FlowSandbox {
  const root = mkdtempSync(join(tmpdir(), 'q2-v1-flow-'))
  cpSync(join(repoRoot, 'studio', 'e2e', 'fixtures', 'v1-flow-tree', 'news'), join(root, 'news'), {
    recursive: true,
  })
  cpSync(join(repoRoot, 'news', '_templates'), join(root, 'news', '_templates'), {
    recursive: true,
  })
  writeFileSync(join(root, SCRATCH_MARKER), '')
  mkdirSync(join(root, 'studio'))
  for (const dir of REGISTRY_DIRS) mkdirSync(join(root, dir))
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}
