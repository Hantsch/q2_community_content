/**
 * Story 026 D3: the image adder of the entry editor. Choosing or dropping one file leads to the
 * same "chosen" state: an editable name, the template's own guidance, the decoded size and every
 * finding of `checkImage`. "Add image" stores the file in `news/img/` through the bridge and hands
 * the resulting `img/<name>` value to the editor - it never writes the entry and never removes a
 * previously referenced image.
 */
import { useEffect, useId, useState } from 'react'
import { addNewsImage, createBridgeClient } from '../../bridge/client'
import {
  checkImage,
  extractImageGuidance,
  imageFieldValue,
  TEMPLATE_IMAGE_EXPECTATIONS,
  type Finding,
} from '../../images/image-expectations'

type AddImage = (
  name: string,
  bytes: Blob,
) => Promise<{ ok: true; image: string } | { ok: false; rule: string; error: string }>

export interface ImageAdderProps {
  readonly template: string
  /** Receives the frontmatter `image` value once the file is stored. */
  readonly onAdded: (value: string) => void
  /** Reads a repository-relative text file; injectable for tests. */
  readonly readText?: (path: string) => Promise<string | undefined>
  readonly addImage?: AddImage
}

interface Chosen {
  readonly file: File
  readonly width: number
  readonly height: number
}

const ACCEPT = 'image/png,image/jpeg,image/webp'
const WARNING_CONFIRM = 'Add anyway — the size does not match this template'
const INPUT_CLASS =
  'min-h-11 rounded-md border border-muted-border p-2 text-base focus-visible:outline-2 focus-visible:outline-selected'

const defaultReadText = (path: string) => createBridgeClient().readText(path)
const defaultAddImage: AddImage = (name, bytes) => addNewsImage(name, bytes)

function FindingList({
  label,
  findings,
}: {
  readonly label: string
  readonly findings: readonly Finding[]
}): React.JSX.Element | null {
  if (findings.length === 0) return null
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <h4 className="font-medium">{label}</h4>
      <ul className="flex flex-col gap-2">
        {findings.map((finding) => (
          <li key={finding.rule}>
            <p className="font-medium">{finding.message}</p>
            <p>Expected: {finding.expected}</p>
            <p>Actual: {finding.actual}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ImageAdder({
  template,
  onAdded,
  readText = defaultReadText,
  addImage = defaultAddImage,
}: ImageAdderProps): React.JSX.Element | null {
  const nameId = useId()
  const [guided, setGuided] = useState<{ template: string; text: string | undefined } | undefined>()
  const guidance = guided?.template === template ? guided.text : undefined
  const [chosen, setChosen] = useState<Chosen | undefined>()
  const [name, setName] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [decodeError, setDecodeError] = useState<string | undefined>()
  const [refusal, setRefusal] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const enabled = Object.prototype.hasOwnProperty.call(TEMPLATE_IMAGE_EXPECTATIONS, template)

  useEffect(() => {
    if (!enabled) return
    let live = true
    void readText(`news/_templates/${template}/README.md`).then((text) => {
      if (live && text !== undefined) setGuided({ template, text: extractImageGuidance(text) })
    })
    return () => {
      live = false
    }
  }, [enabled, template, readText])

  if (!enabled) return null

  async function choose(file: File | undefined): Promise<void> {
    if (!file) return
    setName(file.name)
    setConfirmed(false)
    setRefusal(undefined)
    setDecodeError(undefined)
    setChosen(undefined)
    try {
      const bitmap = await createImageBitmap(file)
      setChosen({ file, width: bitmap.width, height: bitmap.height })
      bitmap.close()
    } catch {
      setDecodeError('The file could not be read as an image.')
    }
  }

  const findings = chosen
    ? checkImage({ template, width: chosen.width, height: chosen.height, bytes: chosen.file.size })
    : undefined
  const canAdd =
    findings !== undefined &&
    findings.refusals.length === 0 &&
    (findings.warnings.length === 0 || confirmed) &&
    name.trim() !== '' &&
    !busy

  async function add(): Promise<void> {
    if (!chosen) return
    setBusy(true)
    setRefusal(undefined)
    const result = await addImage(name, chosen.file)
    setBusy(false)
    if (result.ok) onAdded(imageFieldValue(name))
    else setRefusal(result.error)
  }

  return (
    <section aria-label="Image adder" className="flex flex-col gap-3">
      <h3 className="font-medium">Add an image</h3>
      <section aria-label="Guidance" className="flex flex-col gap-1">
        <h4 className="font-medium">Guidance</h4>
        {guidance !== undefined && <p className="whitespace-pre-wrap text-muted">{guidance}</p>}
      </section>
      <label className="flex flex-col gap-1 font-medium">
        Choose image
        <input
          type="file"
          accept={ACCEPT}
          className={INPUT_CLASS}
          onChange={(event) => {
            void choose(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </label>
      <div
        role="group"
        aria-label="Drop an image here"
        className="flex min-h-11 items-center justify-center rounded-md border border-dashed border-muted-border bg-muted-soft p-4 text-muted"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          void choose(event.dataTransfer.files[0])
        }}
      >
        Drop an image here
      </div>
      {decodeError !== undefined && (
        <p role="alert" className="text-severity-error">
          {decodeError}
        </p>
      )}
      {chosen && findings && (
        <div className="flex flex-col gap-3">
          <label htmlFor={nameId} className="font-medium">
            File name
          </label>
          <input
            id={nameId}
            type="text"
            value={name}
            className={INPUT_CLASS}
            onChange={(event) => {
              setName(event.target.value)
              setRefusal(undefined)
            }}
          />
          <p>
            Size: {chosen.width}×{chosen.height} px, {(chosen.file.size / 1024).toFixed(1)} KB
          </p>
          <FindingList label="Refusals" findings={findings.refusals} />
          <FindingList label="Warnings" findings={findings.warnings} />
          {findings.warnings.length > 0 && findings.refusals.length === 0 && (
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              {WARNING_CONFIRM}
            </label>
          )}
          <button
            type="button"
            disabled={!canAdd}
            className="min-h-11 rounded-md border border-muted-border px-4 font-medium focus-visible:outline-2 focus-visible:outline-selected disabled:text-muted"
            onClick={() => void add()}
          >
            Add image
          </button>
        </div>
      )}
      {refusal !== undefined && (
        <p role="alert" className="text-severity-error">
          {refusal}
        </p>
      )}
    </section>
  )
}
