import { describe, expect, it } from 'vitest'

import type { ContentRepoRead } from '../content-repo/read-content-repo'
import type { EntryDescription } from '../report/__fixtures__/news-tree'
import { makeRead } from './test-support'
import { planPublish, planUnpublish } from './publish-plan'

const NOW = new Date('2026-09-14T00:00:00.000Z')

const published = (id: string, order?: string): EntryDescription => ({
  id,
  template: 'text',
  title: id,
  body: 'Body',
  ...(order === undefined ? {} : { order }),
})

const DRAFT = ['---', 'template: text', 'title: New', '---', 'Body'].join('\n')

function withDraft(read: ContentRepoRead, path: string, text = DRAFT): ContentRepoRead {
  return { ...read, drafts: [{ path, text }] }
}

describe('planPublish', () => {
  it('derives file and id, with and without a date prefix', () => {
    const read = makeRead([])
    const dated = planPublish(
      withDraft(read, 'news/2026-09-01-launch.md'),
      'news/2026-09-01-launch.md',
      NOW,
    )
    expect(dated.row).toEqual({ id: 'launch', file: '2026-09-01-launch.md' })
    const plain = planPublish(withDraft(read, 'news/launch.md'), 'news/launch.md', NOW)
    expect(plain.row).toEqual({ id: 'launch', file: 'launch.md' })
  })

  it('orders after the highest usable order, rounded up to the next ten; 10 when empty', () => {
    const path = 'news/new.md'
    const some = planPublish(
      withDraft(makeRead([published('a', '20'), published('b', '35')]), path),
      path,
      NOW,
    )
    expect(some.frontmatterOrder).toBe(40)
    const exact = planPublish(withDraft(makeRead([published('a', '40')]), path), path, NOW)
    expect(exact.frontmatterOrder).toBe(50)
    expect(planPublish(withDraft(makeRead([]), path), path, NOW)).toMatchObject({
      frontmatterOrder: 10,
      verdict: 'ok',
    })
  })

  it('a draft the pipeline would drop is refused with the reason', () => {
    const path = 'news/broken.md'
    const plan = planPublish(
      withDraft(makeRead([published('a', '10')]), path, 'no frontmatter'),
      path,
      NOW,
    )
    expect(plan.verdict).toEqual({ dropped: 'frontmatter could not be read; entry dropped' })
  })

  it('a duplicate id is reported as dropped', () => {
    const path = 'news/2026-09-01-a.md'
    const plan = planPublish(withDraft(makeRead([published('a', '10')]), path), path, NOW)
    expect(plan.verdict).toEqual({
      dropped: 'duplicate id; the first entry with this id is kept and this one dropped',
    })
  })

  it('a file name the launcher does not fetch is refused', () => {
    const path = 'news/sub/post.md'
    const plan = planPublish(withDraft(makeRead([]), path), path, NOW)
    expect(plan.verdict).toEqual({ dropped: 'the launcher does not fetch this file name' })
  })

  it('a template fallback is not a drop', () => {
    const path = 'news/odd.md'
    const text = ['---', 'template: nonsense', 'title: T', '---', 'Body'].join('\n')
    expect(planPublish(withDraft(makeRead([]), path, text), path, NOW).verdict).toBe('ok')
  })
})

describe('planUnpublish', () => {
  const read = makeRead([published('a', '10'), published('b', '20')])

  it('names the row to remove', () => {
    expect(planUnpublish(read, 1, 'b')).toEqual({
      kind: 'remove',
      indexPosition: 1,
      row: { id: 'b', file: 'b.md' },
    })
  })

  it('refuses when the row at that position carries another id', () => {
    expect(planUnpublish(read, 0, 'b').kind).toBe('refused')
    expect(planUnpublish(read, 9, 'b').kind).toBe('refused')
  })
})
