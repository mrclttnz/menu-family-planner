import { describe, expect, it } from 'vitest'
import { formatDate, getWeekRangeContaining, parseDate } from './dateUtils'

describe('dateUtils', () => {
  it('formatDate zero-pads month and day', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('parseDate round-trips with formatDate (local time)', () => {
    expect(formatDate(parseDate('2026-11-22'))).toBe('2026-11-22')
  })

  it('getWeekRangeContaining aligns to Monday', () => {
    // 2026-11-22 is a Sunday; the Monday-based week containing it is 16..22.
    expect(getWeekRangeContaining(parseDate('2026-11-22'), 1)).toEqual({
      startDate: '2026-11-16',
      endDate: '2026-11-22',
    })
  })

  it('getWeekRangeContaining with -1 starts on the reference date', () => {
    expect(getWeekRangeContaining(parseDate('2026-11-22'), -1)).toEqual({
      startDate: '2026-11-22',
      endDate: '2026-11-28',
    })
  })
})
