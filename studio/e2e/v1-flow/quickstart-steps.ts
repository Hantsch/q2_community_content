// The steps of the v1 authoring flow, and the reader that pulls the same steps out of the
// studio README so the end-to-end flow and the quickstart cannot drift apart.

export const FLOW_STEP_NAMES = [
  'install',
  'start',
  'create',
  'write',
  'frontmatter',
  'image',
  'preview',
  'validate',
  'publish',
] as const

export type FlowStepName = (typeof FLOW_STEP_NAMES)[number]

const START_MARKER = '<!-- flow-steps:start -->'
const END_MARKER = '<!-- flow-steps:end -->'

export function readQuickstartSteps(readmeText: string): string[] {
  const text = readmeText.replace(/\r\n/g, '\n')
  const start = text.indexOf(START_MARKER)
  const end = text.indexOf(END_MARKER)
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`the README needs ${START_MARKER} and ${END_MARKER} around the quickstart list`)
  }
  const block = text.slice(start + START_MARKER.length, end)
  return block
    .split('\n')
    .filter((line) => /^\s*\d+\.\s/.test(line))
    .map((line) => {
      const keyword = /^\s*\d+\.\s+\*\*([^*]+)\*\*/.exec(line)?.[1]
      if (keyword === undefined) {
        throw new Error(`quickstart list item has no bold keyword: "${line.trim()}"`)
      }
      return keyword.trim().toLowerCase()
    })
}
