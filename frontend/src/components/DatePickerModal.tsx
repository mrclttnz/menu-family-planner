import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { formatDate, parseDate } from '../dateUtils'

interface DatePickerModalProps {
  value: string // YYYY-MM-DD
  todayStr: string
  onSelect: (date: string) => void
  onClose: () => void
}

/** Builds the Monday-first grid of a month: leading/trailing nulls pad the weeks. */
export function buildMonthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const lead = (first.getDay() + 6) % 7
  const cells: (string | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(formatDate(new Date(year, month, d)))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export const DatePickerModal: React.FC<DatePickerModalProps> = ({ value, todayStr, onSelect, onClose }) => {
  const { t, i18n } = useTranslation()
  const initial = parseDate(value)
  const [view, setView] = useState({ year: initial.getFullYear(), month: initial.getMonth() })

  const locale = i18n.language && i18n.language.startsWith('en') ? 'en-US' : 'it-IT'
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(view.year, view.month, 1)
  )
  // 2024-01-01 is a Monday
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 1 + i))
  )

  const shiftMonth = (delta: number) => {
    const d = new Date(view.year, view.month + delta, 1)
    setView({ year: d.getFullYear(), month: d.getMonth() })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('today.pick_date')}
        className="bg-white rounded-lg shadow-xl w-full max-w-xs p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label={t('today.prev_month')}
            className="p-1 rounded hover:bg-slate-100"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold capitalize">{monthLabel}</span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label={t('today.next_month')}
            className="p-1 rounded hover:bg-slate-100"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('today.close')}
            className="p-1 rounded hover:bg-slate-100 ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase text-slate-400 mb-1">
          {weekdays.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {buildMonthGrid(view.year, view.month).map((cell, i) =>
            cell === null ? (
              <span key={`empty-${i}`} />
            ) : (
              <button
                key={cell}
                type="button"
                onClick={() => onSelect(cell)}
                aria-pressed={cell === value}
                aria-label={cell}
                className={`py-1 text-xs rounded ${
                  cell === value
                    ? 'bg-brand-600 text-white font-bold'
                    : cell === todayStr
                      ? 'border border-brand-400 text-brand-700 font-semibold hover:bg-brand-50'
                      : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {Number(cell.slice(8))}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
