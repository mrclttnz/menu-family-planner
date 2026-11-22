import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagColorPicker } from './TagColorPicker'
import i18n from '../i18n'
import en from '../locales/en.json'

describe('TagColorPicker', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <TagColorPicker isOpen={false} onClose={() => {}} onSelectColor={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders translated text and follows the active language', async () => {
    const { rerender } = render(
      <TagColorPicker isOpen onClose={() => {}} onSelectColor={() => {}} />,
    )
    expect(screen.getByRole('heading')).toHaveTextContent(en.tags.select_color)

    await i18n.changeLanguage('it')
    rerender(<TagColorPicker isOpen onClose={() => {}} onSelectColor={() => {}} />)
    expect(screen.getByRole('heading')).not.toHaveTextContent(en.tags.select_color)
  })

  it('shows the localized error for an invalid HEX and does not apply it', async () => {
    const onSelect = vi.fn()
    render(<TagColorPicker isOpen onClose={() => {}} onSelectColor={onSelect} />)
    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'zzz')
    expect(await screen.findByText(en.tags.invalid_hex)).toBeInTheDocument()
    expect(onSelect).not.toHaveBeenCalled()
  })
})
