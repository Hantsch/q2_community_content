/**
 * Story 027 D5: the delivered order as a list the author can rearrange. Drag a handle onto a row,
 * or use Move up / Move down: every path ends in the one `onMove(from, to)`. Props only, no fetching.
 */
import type { PendingPlan, PublishingResult } from '../../publishing/use-publishing'
import { ConfirmPanel } from '../dialogs/ConfirmPanel'

export interface OrderListItem {
  readonly id: string
  readonly title: string
  /** `undefined` where the entry has no usable order. */
  readonly order: number | undefined
}

export interface OrderListProps {
  readonly items: readonly OrderListItem[]
  readonly busy: boolean
  readonly pending: PendingPlan | null
  readonly result: PublishingResult | null
  readonly onMove: (from: number, to: number) => void
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

const BUTTON_CLASS =
  'min-h-11 min-w-11 rounded-md border border-muted-border px-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-selected disabled:opacity-50'

function statusText(result: PublishingResult | null): string | null {
  if (result?.kind !== 'changed') return null
  const ids = result.entries.map((entry) => entry.id)
  if (result.operation === 'publish') return `Published: ${ids.join(', ')}`
  if (result.operation === 'unpublish') return `Unpublished: ${ids.join(', ')}`
  return ids.length === 1 ? `Moved: ${ids[0]}` : `Renumbered: ${ids.join(', ')}`
}

export function OrderList({
  items,
  busy,
  pending,
  result,
  onMove,
  onConfirm,
  onCancel,
}: OrderListProps): React.JSX.Element {
  const status = statusText(result)
  return (
    <section aria-label="Order" className="flex min-w-0 flex-col gap-3">
      <h2 className="font-medium">Order</h2>
      <ul className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li
            key={item.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const from = Number(event.dataTransfer.getData('text/plain'))
              if (Number.isInteger(from)) onMove(from, index)
            }}
            className="flex flex-wrap items-center gap-2 rounded-md border border-muted-border p-2"
          >
            <span
              role="img"
              aria-label={`Drag ${item.title}`}
              draggable
              onDragStart={(event) => event.dataTransfer.setData('text/plain', String(index))}
              className="flex min-h-11 min-w-11 cursor-grab items-center justify-center"
            >
              ⠿
            </span>
            <span className="min-w-0 flex-1 font-medium">{item.title}</span>
            <span>Order: {item.order === undefined ? 'not usable' : item.order}</span>
            <button
              type="button"
              disabled={busy || index === 0}
              onClick={() => onMove(index, index - 1)}
              aria-label={`Move up ${item.title}`}
              className={BUTTON_CLASS}
            >
              Move up
            </button>
            <button
              type="button"
              disabled={busy || index === items.length - 1}
              onClick={() => onMove(index, index + 1)}
              aria-label={`Move down ${item.title}`}
              className={BUTTON_CLASS}
            >
              Move down
            </button>
          </li>
        ))}
      </ul>
      {pending?.kind === 'renumber' && (
        <ConfirmPanel
          title="No gap — renumber entries?"
          disabled={busy}
          onConfirm={onConfirm}
          onCancel={onCancel}
        >
          <ul>
            {pending.changes.map((change) => (
              <li key={change.id}>
                {change.id}: {change.from ?? 'none'} → {change.to}
              </li>
            ))}
          </ul>
        </ConfirmPanel>
      )}
      {pending?.kind === 'publish-dropped' && (
        <ConfirmPanel
          title="The launcher would drop this entry"
          confirmLabel="Publish anyway"
          disabled={busy}
          onConfirm={onConfirm}
          onCancel={onCancel}
        >
          <p>
            {pending.file}: {pending.reason}
          </p>
        </ConfirmPanel>
      )}
      {pending?.kind === 'unpublish' && (
        <ConfirmPanel
          title={`Unpublish ${items.find((item) => item.id === pending.id)?.title ?? pending.id}?`}
          disabled={busy}
          onConfirm={onConfirm}
          onCancel={onCancel}
        >
          <p>{pending.file} stays on disk; only its index row is removed.</p>
          <p>
            Launchers that already fetched the feed keep showing this entry until they next poll.
          </p>
        </ConfirmPanel>
      )}
      {status !== null && (
        <p role="status" className="font-medium">
          {status}
        </p>
      )}
      {(result?.kind === 'error' || result?.kind === 'refused') && (
        <p role="alert" className="text-severity-error">
          {result.kind === 'error' ? result.message : result.reason}
        </p>
      )}
    </section>
  )
}
