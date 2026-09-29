/**
 * Story 025 D1: reads the kit README's "Which template?" table so the picker can show the kit's
 * own guidance instead of a copy of it. Never throws; anything unreadable yields `[]`.
 */
export interface TemplateGuidance {
  readonly template: string
  readonly useCase: string
  readonly image: string
}

export function parseTemplateGuidance(readmeText: string): TemplateGuidance[] {
  try {
    const lines = readmeText.split(/\r?\n/)
    const start = lines.findIndex((line) => /^##\s+Which template\?\s*$/.test(line))
    if (start < 0) return []
    const result: TemplateGuidance[] = []
    let inTable = false
    for (const line of lines.slice(start + 1)) {
      const trimmed = line.trim()
      if (trimmed.startsWith('#')) break
      if (!trimmed.startsWith('|')) {
        if (inTable) break
        continue
      }
      inTable = true
      if (/^[\s|:-]+$/.test(trimmed)) continue
      const cells = trimmed
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((cell) => cell.trim())
      if (cells.length < 3) continue
      const name = /\[`([^`]+)`\]/.exec(cells[1])
      if (name) result.push({ template: name[1], useCase: cells[0], image: cells[2] })
    }
    return result
  } catch {
    return []
  }
}
