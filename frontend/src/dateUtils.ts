export function formatDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Returns a 7-day range containing the referenceDate, aligned to startDayOfWeek.
 * startDayOfWeek:
 *   1 = Lunedì (Monday)
 *   6 = Sabato (Saturday)
 *   0 = Domenica (Sunday)
 *  -1 = Oggi (starts on referenceDate)
 */
export function getWeekRangeContaining(
  referenceDate: Date,
  startDayOfWeek: number
): { startDate: string; endDate: string } {
  if (startDayOfWeek === -1) {
    const start = new Date(referenceDate)
    const end = new Date(referenceDate)
    end.setDate(end.getDate() + 6)
    return {
      startDate: formatDate(start),
      endDate: formatDate(end),
    }
  }

  const currentDay = referenceDate.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = (currentDay - startDayOfWeek + 7) % 7
  const start = new Date(referenceDate)
  start.setDate(referenceDate.getDate() - diff)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  }
}
