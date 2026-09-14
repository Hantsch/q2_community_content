/**
 * Story 011 D4: pairs every declared button with what the pipeline actually delivered, and names
 * the pipeline's own reason for each one it dropped (AC5).
 *
 * This is the one place in the report where the pipeline's output has to be *attributed* to a
 * single button rather than only classified, because `sanitizeButtons()` (see the mirrored
 * `feed-pipeline.ts`) does not say which candidate each of its warnings is about:
 *
 *   - `button-host-not-allowed` interpolates the url, so it names its button directly;
 *   - `button-invalid` carries nothing at all ("a button without a usable label/url pair was
 *     dropped");
 *   - `button-cap` carries a count and nothing else - the buttons the cap cut are named nowhere,
 *     they are simply absent from `slide.buttons`.
 *
 * So the attribution runs by elimination, in declaration order - which is safe because
 * `sanitizeButtons()` preserves it: `allowed` is built in candidate order and only sliced at the
 * very end, so the delivered buttons are the first three survivors in the author's own order.
 *
 *   1. a declared button equal to the next not-yet-matched `slide.buttons` entry was kept;
 *   2. of the rest, the ones a `button-host-not-allowed` warning names by url were dropped for
 *      their host;
 *   3. what is left over are the shape rejects and the cap victims, in some interleaving the
 *      pipeline's prose does not reveal - see `isShapeReject()` for how those two are told apart.
 *
 * AC8 holds throughout: which buttons were dropped, how many, and for which reasons all come from
 * the pipeline's own `slide.buttons` and warnings. Nothing here re-checks the host allowlist or
 * re-applies the cap, and a button no pipeline warning explains is reported without a reason
 * rather than given a borrowed one.
 */
import { newsButtonSchema, type NewsFeedWarning } from '../contract/launcher-contract'
import { classifyWarning, type WarningClassification } from './classify-warning'
import type { ButtonVerdict, DeclaredButton, DeliveredEntry, Finding } from './report-types'

/** `sanitizeButtons()`'s own wording for an off-allowlist host, up to the url it appends. Restated
 * here (as in `classify-warning.ts`'s pattern table) because the mirror may not be hand-edited to
 * carry the url as a field - its prose is the only channel it offers. */
const HOST_REJECT_PREFIX = 'button url is not https on an allowlisted host and was dropped: '

/** The warning kinds this module re-reports per button. The spine leaves these out of its own
 * entry-level walk so each one is reported once, against the button it actually concerns. */
const PER_BUTTON_KINDS: ReadonlySet<string> = new Set([
  'button-invalid',
  'button-host-not-allowed',
  'button-cap',
])

/** Whether a classified warning kind is one `buildButtonVerdicts()` attributes to single buttons.
 * `buttons-invalid` ("buttons is not a list") is deliberately not in the set: there are no declared
 * buttons to attribute it to, so it stays an entry-level finding. */
export function isPerButtonWarningKind(kind: string): boolean {
  return PER_BUTTON_KINDS.has(kind)
}

export interface ButtonVerdictsInput {
  /** The entry's declared buttons in declaration order, as the mirrored `parseFrontmatter()` read
   * them - the same list, in the same order, that `sanitizeButtons()` iterated. */
  declared: DeclaredButton[]
  /** What the spine resolved this entry to. `'dropped'` means the pipeline never reached its
   * button step at all. */
  delivered: DeliveredEntry
  /** This entry's own pipeline warnings, in pipeline order. */
  warnings: NewsFeedWarning[]
  entryId: string
  file: string
}

function quote(value: string | undefined): string {
  return value === undefined ? '(none)' : `"${value}"`
}

/** Names the button a finding is about, for the two pipeline reasons whose own wording identifies
 * no button. Appended to - never substituted for - the pipeline's verbatim reason, the same way
 * D3 appends the declared image to a template fallback. */
function describeButton(button: DeclaredButton): string {
  return `(declared label: ${quote(button.label)}, url: ${quote(button.url)})`
}

function toFinding(
  classified: WarningClassification,
  message: string,
  entryId: string,
  file: string,
): Finding {
  return {
    severity: classified.severity,
    kind: classified.kind,
    message,
    entryId,
    file,
    source: 'pipeline',
  }
}

/**
 * Of the declared buttons that were neither delivered nor named by a host warning: is this one a
 * shape reject (`newsButtonSchema` refused it) or a cap victim (valid, but beyond the third
 * survivor)? The pipeline says how many there are of each - one `button-invalid` warning per shape
 * reject, and the cap warning's count for the rest - but never which is which, and there is no
 * ordering rule that separates them either: a shape reject can sit anywhere in the declaration
 * order, including after the buttons the cap cut.
 *
 * The two easy cases need no judgement at all and are answered from the pipeline's counts alone:
 * with no shape-reject warning left, this can only be a cap victim; with no cap warning, only a
 * shape reject. Only when both are in play is the mirrored `newsButtonSchema` - the very schema
 * `sanitizeButtons()` itself ran on this candidate - asked which of the two it was. That decides
 * nothing about the button's fate (the pipeline already did, and its counts stay authoritative);
 * it only assigns the pipeline's own anonymous warning to the button it was about, so an author
 * reading "no usable label/url pair" is not sent to a button that was merely too late in the list.
 */
function isShapeReject(
  button: DeclaredButton,
  hasShapeRejectWarning: boolean,
  hasCapWarning: boolean,
): boolean {
  if (!hasShapeRejectWarning) return false
  if (!hasCapWarning) return true
  return !newsButtonSchema.safeParse(button).success
}

/**
 * One `ButtonVerdict` per declared button, plus one `Finding` per dropped button naming why.
 * See the file header for the attribution and what it does and does not decide.
 */
export function buildButtonVerdicts({
  declared,
  delivered,
  warnings,
  entryId,
  file,
}: ButtonVerdictsInput): { verdicts: ButtonVerdict[]; findings: Finding[] } {
  if (delivered === 'dropped') {
    // The entry never reached step 6 of the pipeline's decision order, so none of its buttons was
    // ever judged. The entry's own `error` finding is the explanation; a per-button finding here
    // would claim a button decision the pipeline never made.
    return {
      verdicts: declared.map((button) => ({
        declared: button,
        kept: false,
        reason: 'entry-dropped',
      })),
      findings: [],
    }
  }

  const classified = warnings
    .map((warning) => classifyWarning(warning))
    .filter((warning) => isPerButtonWarningKind(warning.kind))

  const pendingHostRejects = classified
    .filter((warning) => warning.kind === 'button-host-not-allowed')
    .map((warning) => ({ url: warning.message.slice(HOST_REJECT_PREFIX.length), warning }))
  const pendingShapeRejects = classified.filter((warning) => warning.kind === 'button-invalid')
  const capWarning = classified.find((warning) => warning.kind === 'button-cap')

  const verdicts: ButtonVerdict[] = []
  const findings: Finding[] = []
  let nextDelivered = 0

  for (const button of declared) {
    // Kept: `slide.buttons` is the survivors in declaration order, so the next undelivered one is
    // the only entry this declared button can be.
    const candidate = delivered.buttons[nextDelivered]
    if (
      candidate !== undefined &&
      candidate.label === button.label &&
      candidate.url === button.url
    ) {
      nextDelivered += 1
      verdicts.push({ declared: button, kept: true })
      continue
    }

    // Dropped for its host: the only pipeline button warning that names its own button.
    const hostIndex = pendingHostRejects.findIndex((reject) => reject.url === button.url)
    if (hostIndex >= 0) {
      const [reject] = pendingHostRejects.splice(hostIndex, 1)
      verdicts.push({ declared: button, kept: false, reason: reject.warning.kind })
      findings.push(toFinding(reject.warning, reject.warning.message, entryId, file))
      continue
    }

    const shapeReject = isShapeReject(
      button,
      pendingShapeRejects.length > 0,
      capWarning !== undefined,
    )
      ? pendingShapeRejects.shift()
      : undefined
    if (shapeReject) {
      verdicts.push({ declared: button, kept: false, reason: shapeReject.kind })
      findings.push(
        toFinding(shapeReject, `${shapeReject.message} ${describeButton(button)}`, entryId, file),
      )
      continue
    }

    if (capWarning) {
      // AC5 wants every dropped button to name its own reason, so the single count-only cap warning
      // becomes one finding per victim - each restating the same pipeline fact, against the button
      // it cost.
      verdicts.push({ declared: button, kept: false, reason: capWarning.kind })
      findings.push(
        toFinding(capWarning, `${capWarning.message} ${describeButton(button)}`, entryId, file),
      )
      continue
    }

    // Nothing the pipeline said explains this button. Report it as dropped without a reason rather
    // than borrowing another button's (AC8: the report never invents a pipeline fact).
    verdicts.push({ declared: button, kept: false, reason: 'unclassified' })
  }

  return { verdicts, findings }
}
