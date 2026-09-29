/**
 * Story 021 D2: the "preview as if visible" switch and the marker that says the preview is
 * overridden. Props-in/JSX-out: the caller (`SlidePreview`) owns the override flag and hands over
 * D1's `realState` text, which is the entry's own finding verbatim and is never reworded here.
 *
 * The marker lives outside the slide iframe on purpose, so the frame stays exactly what the
 * launcher would render.
 */

export interface VisibilityOverrideSwitchProps {
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
}

export function VisibilityOverrideSwitch({
  checked,
  onChange,
}: VisibilityOverrideSwitchProps): React.JSX.Element {
  return (
    <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-md border border-muted-border px-3 text-text focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-selected">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 shrink-0"
      />
      <span>Preview as if visible</span>
    </label>
  )
}

export interface VisibilityOverrideMarkerProps {
  readonly realState: string
}

/** The marker's text: names both facts, so it never depends on colour to be read. */
export function overrideMarkerText(realState: string): string {
  return `Override — previewing as if visible. Real state: ${realState}`
}

export function VisibilityOverrideMarker({
  realState,
}: VisibilityOverrideMarkerProps): React.JSX.Element {
  return (
    <p
      role="status"
      className="rounded-md border border-severity-info-border bg-severity-info-soft p-2 font-medium text-severity-info"
    >
      {overrideMarkerText(realState)}
    </p>
  )
}
