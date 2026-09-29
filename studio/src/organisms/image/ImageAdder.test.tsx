// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ImageAdder } from './ImageAdder'

afterEach(cleanup)

const props = { onAdded: () => {}, readText: () => Promise.resolve(undefined) }

describe('ImageAdder', () => {
  it('the image adder is absent for the text template', () => {
    const { container } = render(<ImageAdder template="text" {...props} />)
    expect(container.innerHTML).toBe('')
  })

  it('the image adder offers both inputs for an image template', () => {
    render(<ImageAdder template="cover" {...props} />)
    expect(screen.getByLabelText('Choose image')).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Drop an image here' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add image' })).toBeNull()
  })
})
