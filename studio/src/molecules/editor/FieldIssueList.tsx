/**
 * Story 022 D3: the issues of one field as text under it. Each line names its severity in words
 * and the rule, so it never relies on colour; the list's id is what the field points at through
 * `aria-describedby`.
 */
import type { FieldIssue } from '../../editor/field-rules'

export interface FieldIssueListProps {
  readonly id: string
  readonly issues: readonly FieldIssue[]
}

export function FieldIssueList({ id, issues }: FieldIssueListProps): React.JSX.Element | null {
  if (issues.length === 0) return null
  return (
    <ul id={id} className="flex flex-col gap-1 text-base">
      {issues.map((issue, index) => (
        <li
          key={`${issue.rule}-${index}`}
          className={issue.blocksSave ? 'text-severity-error' : 'text-severity-warning'}
        >
          <strong>{issue.blocksSave ? 'Error' : 'Warning'}</strong> {issue.rule}: {issue.message}
        </li>
      ))}
    </ul>
  )
}

/** The `aria-describedby` value for a field: its issue list and any extra note, when present. */
export function describedBy(
  id: string,
  issues: readonly FieldIssue[],
  note?: boolean,
): string | undefined {
  const ids = [issues.length > 0 ? `${id}-issues` : null, note ? `${id}-note` : null].filter(
    Boolean,
  )
  return ids.length > 0 ? ids.join(' ') : undefined
}
