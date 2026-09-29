import { describe, expect, it } from 'vitest'
import { planEntrySave } from './plan-entry-save'

const doc = (order: string, template = 'text') =>
  `---\ntitle: Hello\ntemplate: ${template}\norder: ${order}\n---\nBody text\n`
const index = (order: number) =>
  JSON.stringify(
    {
      schemaVersion: 1,
      entries: [
        { id: 'a', file: 'a.md', order },
        { id: 'b', file: 'b.md', order: 2 },
      ],
    },
    null,
    2,
  ) + '\n'
const others = { 'b.md': doc('2') }

describe('planEntrySave', () => {
  it('a draft save writes only its document', () => {
    const plan = planEntrySave({
      documentPath: 'news/draft.md',
      openedDocumentText: doc('9'),
      patch: { fields: { title: 'New' }, body: 'Fresh body' },
      openedIndexText: index(1),
      otherDocuments: others,
    })
    if (!plan.ok) throw new Error(plan.reason)
    expect(plan.writes.map((w) => w.path)).toEqual(['news/draft.md'])
    expect(plan.writes[0].text).toContain('title: New')
    expect(plan.writes[0].text).toContain('Fresh body')
    expect(plan.writes[0].expected).toBe(doc('9'))
    expect(plan.drop).toBeUndefined()
  })

  it("a published entry's row is brought into line with its frontmatter order", () => {
    const opened = index(1)
    const plan = planEntrySave({
      documentPath: 'news/a.md',
      openedDocumentText: doc('1'),
      patch: { fields: { order: '5' } },
      openedIndexText: opened,
      otherDocuments: others,
    })
    if (!plan.ok) throw new Error(plan.reason)
    expect(plan.writes.map((w) => w.path)).toEqual(['news/a.md', 'news/index.json'])
    expect(plan.writes[1].expected).toBe(opened)
    expect(JSON.parse(plan.writes[1].text)).toEqual(JSON.parse(index(5)))

    const agreeing = planEntrySave({
      documentPath: 'news/a.md',
      openedDocumentText: doc('1'),
      patch: { fields: { title: 'Other' } },
      openedIndexText: opened,
      otherDocuments: others,
    })
    if (!agreeing.ok) throw new Error(agreeing.reason)
    expect(agreeing.writes.map((w) => w.path)).toEqual(['news/a.md'])
  })

  it("a save that makes the launcher drop the entry reports the pipeline's reason", () => {
    const plan = planEntrySave({
      documentPath: 'news/a.md',
      openedDocumentText: doc('1'),
      patch: { body: '' },
      openedIndexText: index(1),
      otherDocuments: others,
    })
    if (!plan.ok) throw new Error(plan.reason)
    expect(plan.drop?.reason).toContain('dropped')

    const fallback = planEntrySave({
      documentPath: 'news/a.md',
      openedDocumentText: doc('1', 'cover'),
      patch: { fields: { image: null } },
      openedIndexText: index(1),
      otherDocuments: others,
    })
    if (!fallback.ok) throw new Error(fallback.reason)
    expect(fallback.drop).toBeUndefined()
  })

  it('refuses an unparseable index while the entry is published', () => {
    const plan = planEntrySave({
      documentPath: 'news/a.md',
      openedDocumentText: doc('1'),
      patch: {},
      openedIndexText: '{"entries": [ "a.md" ',
      otherDocuments: others,
    })
    expect(plan.ok).toBe(false)
  })
})
