// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BodyEditor } from './BodyEditor'

afterEach(cleanup)

describe('BodyEditor', () => {
  it('the body editor is a plain textarea that emits exactly what was typed', () => {
    const onChange = vi.fn()
    const value = '  # Hello **world** <b>x</b>  \n'
    render(<BodyEditor value={value} onChange={onChange} />)

    const field = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Body' })
    expect(field.tagName).toBe('TEXTAREA')
    expect(field.value).toBe(value)

    const typed = '\n  _typed_ [a](b)  '
    fireEvent.change(field, { target: { value: typed } })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(typed)

    const root = screen.getByTestId('body-editor')
    expect(root.querySelector('[contenteditable]')).toBeNull()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('toolbar')).toHaveLength(0)
  })

  it('an empty body shows the drop-cause error on the field', () => {
    for (const empty of ['', '  \n\t ']) {
      const { unmount } = render(<BodyEditor value={empty} onChange={() => {}} />)
      const field = screen.getByRole('textbox', { name: 'Body' })
      const findings = screen.getAllByTestId('body-finding')
      expect(findings.map((f) => f.getAttribute('data-code'))).toContain('empty-body')
      expect(field.getAttribute('aria-invalid')).toBe('true')
      const list = document.getElementById(field.getAttribute('aria-describedby') ?? '')
      expect(list).not.toBeNull()
      expect(list?.contains(findings[0])).toBe(true)
      unmount()
    }

    render(<BodyEditor value="A plain body." onChange={() => {}} />)
    const field = screen.getByRole('textbox', { name: 'Body' })
    expect(field.hasAttribute('aria-invalid')).toBe(false)
    expect(screen.queryAllByTestId('body-finding')).toHaveLength(0)
  })
})
