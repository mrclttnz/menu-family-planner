import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { buildMonthGrid, DatePickerModal } from './DatePickerModal'
import { TodayView } from './TodayView'

describe('buildMonthGrid', () => {
  it('pads to full Monday-first weeks', () => {
    // November 2026 starts on a Sunday -> 6 leading blanks, 30 days
    const grid = buildMonthGrid(2026, 10)
    expect(grid.length % 7).toBe(0)
    expect(grid.slice(0, 6).every((c) => c === null)).toBe(true)
    expect(grid[6]).toBe('2026-11-01')
    expect(grid.filter(Boolean)).toHaveLength(30)
  })
})

describe('DatePickerModal', () => {
  it('selects a day and navigates months', () => {
    const onSelect = vi.fn()
    render(<DatePickerModal value="2026-11-26" todayStr="2026-11-26" onSelect={onSelect} onClose={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Next month'))
    fireEvent.click(screen.getByLabelText('2026-12-10'))
    expect(onSelect).toHaveBeenCalledWith('2026-12-10')
  })
})

describe('TodayView day navigation', () => {
  const base = {
    slots: [],
    members: [],
    todayStr: '2026-11-26',
    onToggleAttendance: vi.fn(),
    onAssignDish: vi.fn(),
    onRemoveDish: vi.fn(),
    onAddSlotDishNote: vi.fn(),
    onDeleteSlotDishNote: vi.fn(),
    onSetSlotDishRating: vi.fn(),
    onDeleteSlotDishRating: vi.fn(),
  }

  it('moves to previous/next day, picker date and today', () => {
    const onChange = vi.fn()
    const { rerender } = render(<TodayView {...base} selectedDate="2026-11-26" onSelectedDateChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Today' })).toBeDisabled()
    fireEvent.click(screen.getByLabelText('Previous day'))
    expect(onChange).toHaveBeenLastCalledWith('2026-11-25')
    fireEvent.click(screen.getByLabelText('Next day'))
    expect(onChange).toHaveBeenLastCalledWith('2026-11-27')

    fireEvent.click(screen.getByLabelText('Pick a date'))
    fireEvent.click(screen.getByLabelText('2026-11-03'))
    expect(onChange).toHaveBeenLastCalledWith('2026-11-03')

    rerender(<TodayView {...base} selectedDate="2026-11-03" onSelectedDateChange={onChange} />)
    expect(screen.getByText('No meals planned for this day.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(onChange).toHaveBeenLastCalledWith('2026-11-26')
  })
})
