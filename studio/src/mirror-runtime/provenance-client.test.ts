import { expect, test, vi } from 'vitest'
import type { MirrorProvenance } from '../mirror/provenance'
import { fetchMirrorProvenance } from './provenance-client'

const CANNED_PROVENANCE: MirrorProvenance = {
  verdict: 'in-sync',
  launcherCommit: 'abcdef0123456789',
  launcherCommitShort: 'abcdef012345',
  syncedAt: '2026-01-01T00:00:00.000Z',
  ageInDays: 3,
  fileCount: 5,
  mismatchedFiles: [],
}

test('a successful fetch returns the parsed BridgeProvenanceResponse verbatim', async () => {
  const fetchImpl = vi.fn(() => new Response(JSON.stringify(CANNED_PROVENANCE), { status: 200 }))

  const provenance = await fetchMirrorProvenance(fetchImpl as unknown as typeof fetch)

  expect(provenance).toEqual(CANNED_PROVENANCE)
  expect(fetchImpl).toHaveBeenCalledWith('/__studio/fs/provenance')
})

test('the route is called with no query parameters at all, for any input', async () => {
  const fetchImpl = vi.fn(() => new Response(JSON.stringify(CANNED_PROVENANCE), { status: 200 }))

  await fetchMirrorProvenance(fetchImpl as unknown as typeof fetch)

  expect(fetchImpl).toHaveBeenCalledWith('/__studio/fs/provenance')
})

test('a non-2xx response falls back to verdict: unknown naming the error', async () => {
  const fetchImpl = vi.fn(
    () => new Response(JSON.stringify({ error: 'lock file not found' }), { status: 404 }),
  )

  const provenance = await fetchMirrorProvenance(fetchImpl as unknown as typeof fetch)

  expect(provenance.verdict).toBe('unknown')
  expect(provenance.launcherCommit).toBe('')
  expect(provenance.launcherCommitShort).toBe('')
  expect(provenance.syncedAt).toBe('')
  expect(provenance.ageInDays).toBe(0)
  expect(provenance.fileCount).toBe(0)
  expect(provenance.mismatchedFiles).toEqual([])
  expect(provenance.reason).toContain('lock file not found')
})

test('a fetch rejection falls back to verdict: unknown without throwing', async () => {
  const fetchImpl = vi.fn(() => {
    throw new Error('network down')
  })

  const provenance = await fetchMirrorProvenance(fetchImpl)

  expect(provenance.verdict).toBe('unknown')
  expect(provenance.reason).toContain('network down')
})

test('an unparseable JSON body falls back to verdict: unknown', async () => {
  const fetchImpl = vi.fn(() => new Response('not json', { status: 200 }))

  const provenance = await fetchMirrorProvenance(fetchImpl as unknown as typeof fetch)

  expect(provenance.verdict).toBe('unknown')
  expect(provenance.reason).toBeDefined()
})
