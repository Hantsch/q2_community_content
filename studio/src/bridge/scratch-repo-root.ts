import { existsSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, isAbsolute, resolve } from 'node:path'

import { resolveRepoRoot } from '../content-repo/paths'

/** Marker file a scratch repository must carry before the bridge accepts it as its root. */
export const SCRATCH_MARKER = '.q2-studio-e2e-scratch'

/** Environment variable that redirects the bridge to a scratch repository (e2e only). */
export const SCRATCH_ROOT_ENV = 'STUDIO_E2E_REPO_ROOT'

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/**
 * The repository root the file bridge serves and writes to. Without `STUDIO_E2E_REPO_ROOT` this is
 * the checkout, exactly as before. With it set, the path must lie inside the OS temp directory and
 * carry the scratch marker; anything else throws, so an e2e run can never write into the checkout.
 */
export function resolveBridgeRepoRoot(
  configRoot: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const override = env[SCRATCH_ROOT_ENV]
  if (override === undefined || override === '') return resolveRepoRoot(configRoot)

  const root = resolve(override)
  if (!existsSync(root)) throw new Error(`${SCRATCH_ROOT_ENV}: ${root} does not exist`)
  const real = realpathSync(root)
  if (!isInside(realpathSync(tmpdir()), real)) {
    throw new Error(`${SCRATCH_ROOT_ENV}: ${root} is not inside the OS temp directory`)
  }
  if (!existsSync(join(real, SCRATCH_MARKER))) {
    throw new Error(`${SCRATCH_ROOT_ENV}: ${root} has no ${SCRATCH_MARKER} marker`)
  }
  return real
}
