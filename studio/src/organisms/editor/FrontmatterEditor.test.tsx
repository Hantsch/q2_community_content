// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EntryDraftProvider } from '../../context/entry-draft-context'
import { FrontmatterEditor } from './FrontmatterEditor'

const bridge = vi.hoisted(() => ({
  addNewsImage: vi.fn<() => Promise<unknown>>(),
}))

vi.mock('../../bridge/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../bridge/client')>()),
  addNewsImage: bridge.addNewsImage,
  createBridgeClient: () => ({ readText: () => Promise.resolve(undefined) }),
}))

const COVER = `---
template: cover
title: A cover
image: img/old.png
order: 10
---
Body
`

beforeEach(() => {
  vi.stubGlobal('createImageBitmap', () =>
    Promise.resolve({ width: 2560, height: 640, close: () => {} }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  bridge.addNewsImage.mockReset()
})

async function addImage(onImageAdded: () => void): Promise<void> {
  render(
    <EntryDraftProvider file="news/a-cover.md" text={COVER}>
      <FrontmatterEditor onImageAdded={onImageAdded} />
    </EntryDraftProvider>,
  )
  const file = new File([new Uint8Array(16)], 'new.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('Choose image'), { target: { files: [file] } })
  const add = await screen.findByRole('button', { name: 'Add image' })
  await waitFor(() => expect((add as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(add)
}

describe('FrontmatterEditor', () => {
  it('reports a stored image so the repository is re-read, and keeps the new image value', async () => {
    bridge.addNewsImage.mockResolvedValue({ ok: true, image: 'news/img/new.png' })
    const onImageAdded = vi.fn()

    await addImage(onImageAdded)

    await waitFor(() => expect(onImageAdded).toHaveBeenCalledTimes(1))
    expect(screen.getByLabelText('Image (required)')).toHaveProperty('value', 'img/new.png')
  })

  it('does not re-read the repository when the bridge refuses the image', async () => {
    bridge.addNewsImage.mockResolvedValue({ ok: false, rule: 'exists', error: 'already exists' })
    const onImageAdded = vi.fn()

    await addImage(onImageAdded)

    await screen.findByText('already exists')
    expect(onImageAdded).not.toHaveBeenCalled()
  })
})
