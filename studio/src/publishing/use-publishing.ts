/**
 * Story 027 D3: reorder, publish and unpublish for the library. Plans from the read the library
 * holds, writes one batch through the bridge (all files or none, each guarded by the text that read
 * had) and re-reads through `refresh()` after every success; the model is never patched by hand.
 *
 * A gap move and a clean publish write at once. A renumber, a publish the launcher would drop and
 * every unpublish wait for `confirm()` first.
 */
import { useCallback, useRef, useState } from 'react'
import type { BridgeWriteBatchResult, BridgeWriteItem } from '../bridge/bridge-protocol'
import type { ContentRepoRead } from '../content-repo/read-content-repo'
import { buildWriteSet, type ApplyPlan } from './apply-plan'
import { buildOrderSequence, planMove, type OrderChange } from './order-plan'
import { planPublish, planUnpublish } from './publish-plan'

export type PendingPlan =
  | { readonly kind: 'renumber'; readonly changes: readonly OrderChange[] }
  | { readonly kind: 'publish-dropped'; readonly file: string; readonly reason: string }
  | { readonly kind: 'unpublish'; readonly id: string; readonly file: string }

export type PublishingResult =
  | {
      readonly kind: 'changed'
      readonly entries: readonly { id: string; file: string }[]
      /** Set for publish and unpublish; absent for a move or renumber. */
      readonly operation?: 'publish' | 'unpublish'
    }
  | { readonly kind: 'refused'; readonly reason: string }
  | { readonly kind: 'error'; readonly message: string }

export interface UsePublishingInput {
  readonly read: ContentRepoRead | null
  readonly writeBatch: (files: readonly BridgeWriteItem[]) => Promise<BridgeWriteBatchResult>
  /** The news library's `refresh()`: called after every successful write. */
  readonly refresh: () => void
  readonly now?: () => Date
}

export interface UsePublishingResult {
  readonly busy: boolean
  readonly pending: PendingPlan | null
  readonly result: PublishingResult | null
  readonly move: (from: number, to: number) => void
  readonly publish: (draftPath: string, options?: { force?: boolean }) => void
  readonly unpublish: (indexPosition: number, id: string) => void
  readonly confirm: () => void
  readonly cancel: () => void
}

interface Held {
  readonly plan: ApplyPlan
  readonly read: ContentRepoRead
  readonly changed: readonly { id: string; file: string }[]
}

function errorMessage(result: Exclude<BridgeWriteBatchResult, { ok: true }>): string {
  if (result.kind === 'conflict') {
    return `${result.error} (changed on disk: ${result.conflicts.map((c) => c.path).join(', ')})`
  }
  if (result.kind === 'refused') {
    return `${result.error}${result.refused.map((r) => ` ${r.path}: ${r.error}`).join(';')}`
  }
  const done = result.written.length > 0 ? ` (already written: ${result.written.join(', ')})` : ''
  return `${result.error}${done}`
}

export function usePublishing(input: UsePublishingInput): UsePublishingResult {
  const { read, writeBatch, refresh, now = () => new Date() } = input
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<PendingPlan | null>(null)
  const [result, setResult] = useState<PublishingResult | null>(null)
  const held = useRef<Held | null>(null)

  const apply = useCallback(
    async (work: Held) => {
      held.current = null
      setPending(null)
      const set = buildWriteSet(work.read, work.plan)
      if (!set.ok) {
        setResult({ kind: 'error', message: set.reason })
        return
      }
      setBusy(true)
      const outcome = await writeBatch(set.files)
      setBusy(false)
      if (outcome.ok) {
        const operation = work.plan.kind === 'move' ? undefined : work.plan.kind
        setResult({ kind: 'changed', entries: work.changed, operation })
        refresh()
      } else {
        setResult({ kind: 'error', message: errorMessage(outcome) })
      }
    },
    [writeBatch, refresh],
  )

  const hold = useCallback((work: Held, ask: PendingPlan) => {
    held.current = work
    setResult(null)
    setPending(ask)
  }, [])

  const move = useCallback(
    (from: number, to: number) => {
      if (read === null || busy) return
      const plan = planMove(buildOrderSequence(read), from, to)
      if (plan.kind === 'none') return
      const work: Held = {
        plan: { kind: 'move', changes: plan.changes },
        read,
        changed: plan.changes.map(({ id, file }) => ({ id, file })),
      }
      setResult(null)
      if (plan.kind === 'gap') void apply(work)
      else hold(work, { kind: 'renumber', changes: plan.changes })
    },
    [read, busy, apply, hold],
  )

  const publish = useCallback(
    (draftPath: string, options?: { force?: boolean }) => {
      if (read === null || busy) return
      const plan = planPublish(read, draftPath, now())
      const work: Held = { plan: { kind: 'publish', draftPath, plan }, read, changed: [plan.row] }
      setResult(null)
      if (plan.verdict !== 'ok' && options?.force !== true) {
        hold(work, { kind: 'publish-dropped', file: plan.row.file, reason: plan.verdict.dropped })
      } else void apply(work)
    },
    [read, busy, now, apply, hold],
  )

  const unpublish = useCallback(
    (indexPosition: number, id: string) => {
      if (read === null || busy) return
      const plan = planUnpublish(read, indexPosition, id)
      if (plan.kind === 'refused') {
        setPending(null)
        setResult({ kind: 'refused', reason: plan.reason })
        return
      }
      hold(
        { plan: { kind: 'unpublish', plan }, read, changed: [plan.row] },
        { kind: 'unpublish', id: plan.row.id, file: plan.row.file },
      )
    },
    [read, busy, hold],
  )

  const confirm = useCallback(() => {
    if (held.current !== null && !busy) void apply(held.current)
  }, [busy, apply])

  const cancel = useCallback(() => {
    held.current = null
    setPending(null)
  }, [])

  return { busy, pending, result, move, publish, unpublish, confirm, cancel }
}
