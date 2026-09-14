/**
 * Story 014 D3: the content-type navigation — renders whatever descriptors it is handed, in the
 * order it is handed them. It does not know the registry exists (`StudioPage` builds it and passes
 * the result down), and it does not know any content-type id or label by name: adding a seventh
 * content type to the registry needs no change here (AC6).
 */
import type { ContentTypeDescriptor } from '../content-types/descriptor'

export interface ContentTypeNavProps {
  readonly descriptors: readonly ContentTypeDescriptor[]
  readonly selectedId: ContentTypeDescriptor['id']
  readonly onSelect: (id: ContentTypeDescriptor['id']) => void
}

export function ContentTypeNav({
  descriptors,
  selectedId,
  onSelect,
}: ContentTypeNavProps): React.JSX.Element {
  return (
    <nav aria-label="Content types">
      <ul className="flex flex-col gap-1">
        {descriptors.map((descriptor) => {
          const isSelected = descriptor.id === selectedId

          return (
            <li key={descriptor.id}>
              <button
                type="button"
                aria-current={isSelected ? 'page' : undefined}
                onClick={() => onSelect(descriptor.id)}
                className="min-h-11 min-w-11 w-full rounded-md px-3 py-2 text-left font-medium aria-[current=page]:font-bold"
              >
                {descriptor.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
