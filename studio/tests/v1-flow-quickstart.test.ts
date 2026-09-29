import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FLOW_STEP_NAMES, readQuickstartSteps } from '../e2e/v1-flow/quickstart-steps'

const readme = readFileSync(fileURLToPath(new URL('../README.md', import.meta.url)), 'utf8')

describe('v1 flow quickstart steps', () => {
  it("the quickstart lists exactly the flow's steps, in order", () => {
    expect(readQuickstartSteps(readme)).toEqual([...FLOW_STEP_NAMES])
  })

  it("every quickstart heading is one of the flow's steps, in order", () => {
    const headings = [...readme.matchAll(/^### \d+\. (\S+)/gm)].map((m) => m[1].toLowerCase())
    expect(headings.length).toBeGreaterThan(0)
    let from = 0
    for (const heading of headings) {
      const at = FLOW_STEP_NAMES.indexOf(heading as (typeof FLOW_STEP_NAMES)[number], from)
      expect(at, `heading "${heading}" is not a later flow step`).toBeGreaterThanOrEqual(0)
      from = at + 1
    }
  })

  it('a quickstart without the step markers is refused', () => {
    expect(() => readQuickstartSteps('1. **Install** — x')).toThrow(/flow-steps/)
    expect(() =>
      readQuickstartSteps('<!-- flow-steps:start -->\n1. Install it\n<!-- flow-steps:end -->'),
    ).toThrow(/bold keyword/)
  })
})
