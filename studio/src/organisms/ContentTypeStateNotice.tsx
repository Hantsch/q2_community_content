/**
 * Story 014 D4: the content region for whichever content type is selected in `StudioPage`. Every
 * type that is not editable here yet still gets an honest, non-empty notice instead of a blank
 * area (AC5) — a `switch` on `descriptor.state` covers all three states, with a `never` check so a
 * fourth state added to `ContentTypeState` fails the build here instead of silently rendering
 * nothing.
 *
 * The reserved branch renders `conceptPath` as plain text, deliberately never as an `<a href>`:
 * the local file bridge (story 015 AC3) may only serve directories a descriptor declares, so
 * `docs/` is unreachable through it and a link would be exactly the dead control AC5 forbids.
 */
import type { ContentTypeDescriptor } from '../content-types/descriptor'

export interface ContentTypeStateNoticeProps {
  readonly descriptor: ContentTypeDescriptor
}

export function ContentTypeStateNotice({
  descriptor,
}: ContentTypeStateNoticeProps): React.JSX.Element {
  switch (descriptor.state) {
    case 'reserved':
      return (
        <div className="flex flex-col gap-2">
          <p className="font-medium">
            {descriptor.label}: reserved — the launcher does not read this yet.
          </p>
          <p>
            Concept document: <code>{descriptor.conceptPath}</code>
          </p>
        </div>
      )
    case 'launcher-reads':
      return (
        <div className="flex flex-col gap-2">
          <p className="font-medium">
            {descriptor.label}: read by the launcher, not editable here yet.
          </p>
          <p>Editing support for this content type has not been built yet.</p>
        </div>
      )
    case 'implemented':
      return (
        <div aria-label={`${descriptor.label} content`} className="flex flex-col gap-2">
          <p>Library view for {descriptor.label} — coming in story 016.</p>
        </div>
      )
    default: {
      const exhaustive: never = descriptor.state
      throw new Error(`Unhandled content type state: ${String(exhaustive)}`)
    }
  }
}
