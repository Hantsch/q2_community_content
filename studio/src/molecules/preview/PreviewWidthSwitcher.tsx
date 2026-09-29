/**
 * Story 019 D1: picks the width the preview renders at. Every option names its pixel width and,
 * where the launcher has one, what that width is. The selected option is `aria-pressed` and styled
 * with the selected role, and the readout states the current width in words too.
 */
import { PREVIEW_WIDTHS, type PreviewWidth } from '../../preview/preview-widths'

export interface PreviewWidthSwitcherProps {
  readonly width: number
  readonly onChange: (px: number) => void
}

function label({ px, note }: PreviewWidth, separator: string): string {
  return note ? `${px} px${separator}${note}` : `${px} px`
}

export function PreviewWidthSwitcher({
  width,
  onChange,
}: PreviewWidthSwitcherProps): React.JSX.Element {
  const current = PREVIEW_WIDTHS.find((option) => option.px === width) ?? { px: width }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Preview width" className="flex flex-wrap gap-2">
        {PREVIEW_WIDTHS.map((option) => {
          const pressed = option.px === width
          return (
            <button
              key={option.px}
              type="button"
              aria-pressed={pressed}
              onClick={() => onChange(option.px)}
              className={`min-h-11 min-w-11 rounded-md border px-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-selected ${
                pressed
                  ? 'border-selected-border bg-selected-soft font-medium text-selected'
                  : 'border-muted-border text-muted'
              }`}
            >
              {label(option, ' — ')}
            </button>
          )
        })}
      </div>
      <span data-testid="preview-width-current" className="text-muted">
        {current.note ? `${current.px} px (${current.note})` : `${current.px} px`}
      </span>
    </div>
  )
}
