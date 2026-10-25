import React from 'react'
import { MealSlot, Member, Dish } from '../types'
import { AlertTriangle, Star, CheckCircle, Plus, Users, UserX, Clock } from 'lucide-react'

interface TodayViewProps {
  slots: MealSlot[]
  members: Member[]
  dishes: Dish[]
  onToggleAttendance: (slotId: number, memberId: number, isAttending: boolean) => void
  onAssignDish: (slotId: number) => void
  onRemoveDish: (slotId: number, dishId: number) => void
}

export const TodayView: React.FC<TodayViewProps> = ({
  slots,
  members,
  onToggleAttendance,
  onAssignDish,
  onRemoveDish,
}) => {
  const todayFormatted = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center space-x-2 text-emerald-100 text-xs font-semibold uppercase tracking-wider">
          <Clock className="w-4 h-4" />
          <span>Oggi a Tavola</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold capitalize mt-1">
          {todayFormatted}
        </h1>
        <p className="text-sm text-emerald-100 mt-1">
          Tutti i membri sono considerati a tavola di default. Fai un tap sul nome per registrare un'assenza.
        </p>
      </div>

      {/* Meals Grid */}
      {slots.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
          <p className="text-slate-500">Nessun pasto pianificato per oggi.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {slots.map((slot) => {
            const absentSet = new Set(slot.absent_member_ids)
            return (
              <div
                key={slot.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between"
              >
                {/* Slot Header */}
                <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-100 text-brand-800">
                      {slot.meal_type.name}
                    </span>
                    <span className="flex items-center text-xs font-medium text-slate-500">
                      <Users className="w-3.5 h-3.5 mr-1" />
                      {slot.attendee_count} {slot.attendee_count === 1 ? 'commensale' : 'commensali'}
                    </span>
                  </div>

                  <button
                    onClick={() => onAssignDish(slot.id)}
                    className="flex items-center space-x-1 text-xs font-semibold text-brand-600 hover:text-brand-700 bg-white border border-brand-200 hover:border-brand-300 px-2.5 py-1.5 rounded-lg shadow-2xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Aggiungi piatto</span>
                  </button>
                </div>

                {/* Diners Attendance Pills (Exception-based) */}
                <div className="px-5 py-3 bg-slate-50/40 border-b border-slate-100">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Presenze (Tap per cambiare stato)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {members.map((m) => {
                      const isAbsent = absentSet.has(m.id)
                      return (
                        <button
                          key={m.id}
                          onClick={() => onToggleAttendance(slot.id, m.id, isAbsent)}
                          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                            !isAbsent
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-400 line-through border border-dashed border-slate-300'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: m.avatar_color || '#3B82F6' }}
                          />
                          <span>{m.name}</span>
                          {isAbsent ? (
                            <UserX className="w-3 h-3 text-slate-400" />
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Dishes in this Slot */}
                <div className="p-5 space-y-4 flex-1">
                  {slot.dishes.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-sm">
                      Nessun piatto ancora scelto per questo pasto.
                    </div>
                  ) : (
                    slot.dishes.map((dishAssign) => {
                      const comp = dishAssign.compatibility
                      return (
                        <div
                          key={dishAssign.id}
                          className="p-3.5 rounded-xl border border-slate-200/80 hover:border-slate-300 bg-white transition-all space-y-2.5"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold text-slate-900 text-base">
                                {dishAssign.dish_title}
                              </h4>
                              {dishAssign.notes && (
                                <p className="text-xs text-slate-500 italic mt-0.5">
                                  {dishAssign.notes}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => onRemoveDish(slot.id, dishAssign.dish_id)}
                              className="text-slate-400 hover:text-rose-500 text-xs px-1.5 py-0.5 rounded transition-colors"
                              title="Rimuovi dal pasto"
                            >
                              ✕
                            </button>
                          </div>

                          {/* Smart Compatibility Alert */}
                          {comp.status === 'warning' && (
                            <div className="flex items-center space-x-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
                              <span className="font-medium">{comp.message}</span>
                            </div>
                          )}

                          {comp.status === 'hit' && (
                            <div className="flex items-center space-x-1.5 p-2 rounded-lg bg-pink-50 border border-pink-200 text-pink-800 text-xs">
                              <Star className="w-4 h-4 flex-shrink-0 text-pink-600 fill-pink-500" />
                              <span className="font-medium">{comp.message}</span>
                            </div>
                          )}

                          {comp.status === 'ok' && !comp.is_conflict && (
                            <div className="flex items-center space-x-1 text-emerald-700 text-xs">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Tutto ok per i commensali presenti</span>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
