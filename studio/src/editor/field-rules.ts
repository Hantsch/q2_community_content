/**
 * Story 022 D2: field rules for a frontmatter draft. Button verdicts come from the mirrored
 * launcher exports (schema, host allowlist, cap) - this module only words them. Dates and
 * presentation values are studio-side authoring checks.
 */
import {
  MAX_BUTTONS_PER_SLIDE,
  NEWS_BUTTON_HOST_ALLOWLIST,
  isAllowedButtonHost,
  newsButtonSchema,
} from '../contract/launcher-contract'
import { isKnownTemplate, type EntryDraft } from './frontmatter-draft'

export type FieldName = 'template' | 'title' | 'image' | 'visibleFrom' | 'visibleUntil' | 'buttons'

export interface FieldIssue {
  field: FieldName
  /** Position (0-based) of the button, for `buttons` issues. */
  index?: number
  rule: string
  message: string
  blocksSave: boolean
}

const INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|([+-])(\d{2}):(\d{2}))$/
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function isInstant(value: string): boolean {
  const m = INSTANT.exec(value)
  if (!m) return false
  const [year, month, day, hour, minute] = [m[1], m[2], m[3], m[4], m[5]].map(Number)
  const second = m[6] === undefined ? 0 : Number(m[6])
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return false
  if (hour > 23 || minute > 59 || second > 59) return false
  if (m[8] !== undefined && (Number(m[8]) > 23 || Number(m[9]) > 59)) return false
  return Number.isFinite(Date.parse(value))
}

function dateIssue(field: 'visibleFrom' | 'visibleUntil', value: string): FieldIssue | null {
  if (value === '' || isInstant(value)) return null
  const message = DATE_ONLY.test(value)
    ? `${field}: a date alone is not an instant — add a time and a zone, e.g. 2026-08-01T00:00:00Z`
    : `${field}: not a full ISO 8601 instant with a zone (YYYY-MM-DDTHH:MM:SSZ or ±HH:MM)`
  return { field, rule: 'date', message, blocksSave: true }
}

const PRESENTATION_RULES: { rule: string; test: RegExp }[] = [
  { rule: 'HTML tag or comment', test: /<\/?[a-z][^>]*>|<\/[a-z]|<!--/i },
  { rule: 'CSS declaration', test: /\bstyle\s*=|\b[a-z-]{2,}\s*:\s*[^;:]+;/i },
  { rule: 'CSS function', test: /\b(?:rgba?|hsla?|var|calc|url)\s*\(/i },
  {
    rule: 'hex colour',
    test: /#(?=[0-9a-f]*[a-f])(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![0-9a-z])/i,
  },
  { rule: 'CSS length', test: /(?<![\w.])\d+(?:\.\d+)?(?:px|rem|em|vh|vw)\b/i },
]

function presentationIssues(
  field: FieldName,
  label: string,
  value: string,
  index?: number,
): FieldIssue[] {
  return PRESENTATION_RULES.filter((r) => r.test.test(value)).map((r) => ({
    field,
    ...(index === undefined ? {} : { index }),
    rule: 'presentation',
    message: `${label} carries presentation (${r.rule}) — the launcher owns all styling`,
    blocksSave: true,
  }))
}

const HOSTS = NEWS_BUTTON_HOST_ALLOWLIST.join(' / ')

function urlWording(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'not a URL'
  }
  if (parsed.protocol !== 'https:') return 'not https'
  return `host ${parsed.hostname} is not exactly ${HOSTS} (subdomains included)`
}

function buttonIssues(draft: EntryDraft): FieldIssue[] {
  const issues: FieldIssue[] = []
  let survivors = 0
  draft.fields.buttons.forEach((button, index) => {
    const pos = `button ${index + 1}${button.label ? ` "${button.label}"` : ''}`
    const warn = (rule: string, message: string) =>
      issues.push({ field: 'buttons', index, rule, message, blocksSave: false })
    const parsed = newsButtonSchema.safeParse(button)
    if (!parsed.success) {
      if (button.label.length === 0) warn('button-label', `${pos}: missing label, dropped`)
      if (!parsed.error.issues.every((i) => i.path[0] === 'label')) {
        warn('button-url', `${pos}: ${urlWording(button.url)}, dropped`)
      }
      return
    }
    if (!isAllowedButtonHost(button.url)) {
      warn('button-url', `${pos}: ${urlWording(button.url)}, dropped`)
      return
    }
    if (survivors >= MAX_BUTTONS_PER_SLIDE) {
      warn('button-cap', `${pos}: dropped: beyond the cap of ${MAX_BUTTONS_PER_SLIDE}`)
      return
    }
    survivors += 1
  })
  return issues
}

export function validateDraft(draft: EntryDraft): FieldIssue[] {
  const { fields } = draft
  const issues: FieldIssue[] = []
  if (fields.template !== '' && !isKnownTemplate(fields.template)) {
    issues.push({
      field: 'template',
      rule: 'template',
      message: 'unknown template, delivered as text',
      blocksSave: false,
    })
  }
  for (const field of ['visibleFrom', 'visibleUntil'] as const) {
    const issue = dateIssue(field, fields[field])
    if (issue) issues.push(issue)
  }
  issues.push(...presentationIssues('title', 'title', fields.title))
  issues.push(...presentationIssues('image', 'image', fields.image))
  fields.buttons.forEach((b, i) =>
    issues.push(...presentationIssues('buttons', `button ${i + 1} label`, b.label, i)),
  )
  issues.push(...buttonIssues(draft))
  return issues
}

export function canSave(draft: EntryDraft): boolean {
  return !validateDraft(draft).some((i) => i.blocksSave)
}
