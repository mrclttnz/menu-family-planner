import React, { useState } from 'react'
import { MealSlot, Member, MealType, Dish } from '../types'
import { Calendar as CalendarIcon, Plus, Trash2, AlertTriangle, Star, CheckCircle, ChevronLeft, ChevronRight, Utensils } from 'lucide-react'

interface CalendarViewProps {
  slots: MealSlot[]
  members: Member[]
  dishes: Dish[]
  mealTypes: MealType[]
  startDate: string
  endDate: string
  onDateRangeChange: (start: string, end: string) => void
  onAddCustomSlot: (date: string, mealTypeId: number) => void
  onDeleteSlot: (slotId: number) => void
  onAssignDish: (slotId: number, dishId: number) => void
  onRemoveDish: (slotId: number, dishId: number) => void
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  slots,
  dishes,
  mealTypes,
  startDate,
  endDate,
  onDateRangeChange,
  onAddCustomSlot,
  onDeleteSlot,
  onAssignDish,
  onRemoveDish,
}) => {
  const [selectedSlotForDish, setSelectedSlotForDish] = useState<number | null>(null)
  const [selectedMealTypeForDate, setSelectedMealTypeForDate] = useState<string | null>(null)
  const [newSlotMealTypeId, setNewSlotMealTypeId] = useState<number>(mealTypes[0]?.id || 1)

  // Shift 7 days
  const handleShiftDays = (direction: 'prev' | 'next') => {
    const start = new Date(startDate)
    const offset = direction === 'next' ? 7 : -7
    start.setDate(start.getDate() + offset)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    onDateRangeChange(start.toISOString().split('T')[0], end.toISOString().split('T')[0])
  }

  // Group slots by date
  const slotsByDate: { [date: string]: MealSlot[] } = {}
  slots.forEach((s) => {
    if (!slotsByDate[s.date]) slotsByDate[s.date] = []
    slotsByDate[s.date].push(s)
  })

  const sortedDates = Object.keys(slotsByDate).sort()

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Top Header & Navigation */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-brand-600" />
            <span>Pianificatore Pasti</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pianifica e personalizza i pasti della settimana per tutta la famiglia
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleShiftDays('prev')}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Settimana precedente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold px-3 py-1.5 bg-slate-100 rounded-lg text-slate-700">
            {startDate} ➔ {endDate}
          </span>
          <button
            onClick={() => handleShiftDays('next')}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Settimana successiva"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Days List */}
      <div className="space-y-6">
        {sortedDates.map((dateStr) => {
          const daySlots = slotsByDate[dateStr]
          const dateObj = new Date(dateStr)
          const isToday = new Date().toISOString().split('T')[0] === dateStr
          const dayTitle = new Intl.DateTimeFormat('it-IT', {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
          }).format(dateObj)

          return (
            <div
              key={dateStr}
              className={`bg-white rounded-2xl border ${
                isToday ? 'border-brand-400 shadow-sm' : 'border-slate-200'
              } overflow-hidden`}
            >
              {/* Day Header */}
              <div
                className={`px-5 py-3 flex items-center justify-between border-b ${
                  isToday
                    ? 'bg-brand-50 border-brand-200 text-brand-900'
                    : 'bg-slate-50/80 border-slate-200/80 text-slate-800'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="font-bold capitalize text-base">{dayTitle}</span>
                  {isToday && (
                    <span className="bg-brand-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                      Oggi
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setSelectedMealTypeForDate(dateStr)}
                  className="flex items-center space-x-1 text-xs font-medium text-slate-600 hover:text-brand-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Aggiungi pasto (es. Brunch)</span>
                </button>
              </div>

              {/* Day's Meal Slots */}
              <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {daySlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {slot.meal_type.name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {slot.attendee_count} a tavola
                        </span>
                      </div>

                      <button
                        onClick={() => onDeleteSlot(slot.id)}
                        title="Elimina questo pasto dal piano"
                        className="text-slate-300 hover:text-rose-500 p-1 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Dishes in this slot */}
                    <div className="space-y-2 flex-1">
                      {slot.dishes.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">
                          Nessun piatto pianificato.
                        </p>
                      ) : (
                        slot.dishes.map((d) => (
                          <div
                            key={d.id}
                            className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between font-medium text-slate-800">
                              <span>{d.dish_title}</span>
                              <button
                                onClick={() => onRemoveDish(slot.id, d.dish_id)}
                                className="text-slate-400 hover:text-rose-500 px-1"
                              >
                                ✕
                              </button>
                            </div>

                            {/* Smart Compatibility Alert */}
                            {d.compatibility.status === 'warning' && (
                              <div className="flex items-center space-x-1 text-amber-700 font-medium bg-amber-50 p-1.5 rounded">
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>{d.compatibility.message}</span>
                              </div>
                            )}

                            {d.compatibility.status === 'hit' && (
                              <div className="flex items-center space-x-1 text-pink-700 font-medium bg-pink-50 p-1.5 rounded">
                                <Star className="w-3.5 h-3.5 flex-shrink-0 fill-pink-500" />
                                <span>{d.compatibility.message}</span>
                              </div>
                            )}

                            {d.compatibility.status === 'ok' && !d.compatibility.is_conflict && (
                              <div className="flex items-center space-x-1 text-emerald-600 text-[11px]">
                                <CheckCircle className="w-3 h-3" />
                                <span>Gradito</span>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedSlotForDish(slot.id)}
                      className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-brand-700 font-medium text-xs rounded-lg border border-slate-200/80 transition-colors flex items-center justify-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Scegli piatto dal catalogo</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal: Add Custom Slot to Date */}
      {selectedMealTypeForDate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="font-bold text-lg text-slate-900">Aggiungi Tipo di Pasto</h3>
            <p className="text-xs text-slate-500">
              Scegli quale pasto aggiungere al giorno {selectedMealTypeForDate} (es. Brunch, Merenda, Colazione):
            </p>

            <select
              value={newSlotMealTypeId}
              onChange={(e) => setNewSlotMealTypeId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
            >
              {mealTypes.map((mt) => (
                <option key={mt.id} value={mt.id}>
                  {mt.name}
                </option>
              ))}
            </select>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setSelectedMealTypeForDate(null)}
                className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  onAddCustomSlot(selectedMealTypeForDate, newSlotMealTypeId)
                  setSelectedMealTypeForDate(null)
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Pick Dish for Slot */}
      {selectedSlotForDish !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900 flex items-center space-x-2">
                <Utensils className="w-5 h-5 text-brand-600" />
                <span>Scegli Piatto per il Menù</span>
              </h3>
              <button
                onClick={() => setSelectedSlotForDish(null)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {dishes.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">
                  Nessun piatto ancora presente nel catalogo. Vai alla sezione "Catalogo Ricette" per aggiungerne uno!
                </p>
              ) : (
                dishes.map((dish) => (
                  <div
                    key={dish.id}
                    onClick={() => {
                      onAssignDish(selectedSlotForDish, dish.id)
                      setSelectedSlotForDish(null)
                    }}
                    className="p-3 rounded-xl border border-slate-200 hover:border-brand-500 hover:bg-brand-50/50 cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">{dish.title}</h4>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {dish.courses.map((c) => (
                          <span
                            key={c.id}
                            className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium"
                          >
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${dish.status.color}15`,
                        color: dish.status.color,
                      }}
                    >
                      {dish.status.name}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
