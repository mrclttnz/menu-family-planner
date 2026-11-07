import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MealSlot, Member, Dish } from '../types'
import { getLocalizedMealTypeName, getLocalizedCompatibilityMessage } from '../taxonomyUtils'
import {
  AlertTriangle,
  Star,
  CheckCircle,
  Plus,
  Users,
  UserX,
  Clock,
  MessageSquare,
  X,
  Meh,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react'

interface TodayViewProps {
  slots: MealSlot[]
  members: Member[]
  dishes?: Dish[]
  onToggleAttendance: (slotId: number, memberId: number, isAttending: boolean) => void
  onAssignDish: (slotId: number) => void
  onRemoveDish: (slotId: number, dishId: number) => void
  onAddSlotDishNote: (slotId: number, dishId: number, note: string) => void
  onDeleteSlotDishNote: (slotId: number, dishId: number, noteId: number) => void
  onSetSlotDishRating: (slotId: number, dishId: number, memberId: number, rating: 'thumbs_up' | 'neutral' | 'thumbs_down') => Promise<void>
  onDeleteSlotDishRating: (slotId: number, dishId: number, memberId: number) => Promise<void>
}

export const TodayView: React.FC<TodayViewProps> = ({
  slots,
  members,
  dishes,
  onToggleAttendance,
  onAssignDish,
  onRemoveDish,
  onAddSlotDishNote,
  onDeleteSlotDishNote,
  onSetSlotDishRating,
  onDeleteSlotDishRating,
}) => {
  const { t, i18n } = useTranslation()
  const [activeNoteDishId, setActiveNoteDishId] = useState<{ slotId: number; dishId: number } | null>(null)
  const [noteText, setNoteText] = useState('')

  const currentLocale = i18n.language && i18n.language.startsWith('en') ? 'en-US' : 'it-IT'
  const todayFormatted = new Intl.DateTimeFormat(currentLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  const handleSaveNote = (slotId: number, dishId: number) => {
    if (!noteText.trim()) return
    onAddSlotDishNote(slotId, dishId, noteText.trim())
    setNoteText('')
    setActiveNoteDishId(null)
  }

  return (
    <div className="space-y-2 pb-14 md:pb-3">
      {/* Header Banner (G002: super compact) */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-lg px-3 py-1.5 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <div>
          <div className="flex items-center space-x-1 text-emerald-100 text-[10px] font-semibold uppercase tracking-wider">
            <Clock className="w-3 h-3" />
            <span>{t('today.banner_title')}</span>
          </div>
          <h1 className="text-sm sm:text-base font-bold capitalize leading-tight">
            {todayFormatted}
          </h1>
        </div>
        <p className="text-[11px] text-emerald-100">
          {t('today.banner_subtitle')}
        </p>
      </div>

      {/* Meals Grid */}
      {slots.length === 0 ? (
        <div className="bg-white rounded-lg p-5 text-center border border-slate-200">
          <p className="text-slate-500 text-xs">{t('today.no_meals')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {slots.map((slot) => {
            const absentSet = new Set(slot.absent_member_ids)
            return (
              <div
                key={slot.id}
                className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between"
              >
                {/* Slot Header */}
                <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-brand-100 text-brand-800">
                      {getLocalizedMealTypeName(slot.meal_type, t)}
                    </span>
                    <span className="flex items-center text-[11px] font-medium text-slate-500">
                      <Users className="w-3 h-3 mr-1" />
                      {slot.attendee_count} {t('today.at_table')}
                    </span>
                  </div>

                  <button
                    onClick={() => onAssignDish(slot.id)}
                    className="flex items-center space-x-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 bg-white border border-brand-200 hover:border-brand-300 px-2 py-0.5 rounded shadow-2xs transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t('today.add_dish')}</span>
                  </button>
                </div>

                {/* Diners Attendance Pills (Exception-based) */}
                <div className="px-3 py-1.5 bg-slate-50/40 border-b border-slate-100 flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex-shrink-0">
                    {t('today.attendance')}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {members.map((m) => {
                      const isAbsent = absentSet.has(m.id)
                      return (
                        <button
                          key={m.id}
                          onClick={() => onToggleAttendance(slot.id, m.id, isAbsent)}
                          className={`flex items-center space-x-1 px-1.5 py-0.2 rounded-full text-[10px] font-medium transition-all ${
                            !isAbsent
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-400 line-through border border-dashed border-slate-300'
                          }`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: m.avatar_color || '#3B82F6' }}
                          />
                          <span>{m.name}</span>
                          {isAbsent ? (
                            <UserX className="w-2.5 h-2.5 text-slate-400" />
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Dishes in this Slot */}
                <div className="p-2.5 space-y-2 flex-1">
                  {slot.dishes.length === 0 ? (
                    <div className="text-center py-4 text-slate-400 text-xs">
                      {t('today.no_dishes')}
                    </div>
                  ) : (
                    slot.dishes.map((dishAssign) => {
                      const comp = dishAssign.compatibility
                      const hasAssignedMembers =
                        dishAssign.assigned_member_ids && dishAssign.assigned_member_ids.length > 0
                      const assignedMembersList = hasAssignedMembers
                        ? members.filter((m) => dishAssign.assigned_member_ids?.includes(m.id))
                        : []

                      const isAddingNote =
                        activeNoteDishId?.slotId === slot.id && activeNoteDishId?.dishId === dishAssign.dish_id

                      return (
                        <div
                          key={dishAssign.id}
                          className="p-2 rounded-md border border-slate-200/80 hover:border-slate-300 bg-white transition-all space-y-1.5 text-xs"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center space-x-1.5 flex-wrap">
                                <h4 className="font-semibold text-slate-900 text-xs sm:text-sm">
                                  {dishAssign.dish_title}
                                </h4>
                                {/* P002: Badge for alternative dish */}
                                {hasAssignedMembers && (
                                  <span className="text-[9px] font-medium bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded">
                                    {t('today.alternative_for')}{' '}
                                    {assignedMembersList.map((m) => m.name).join(', ')}
                                  </span>
                                )}
                              </div>
                              {dishAssign.notes && (
                                <p className="text-[10px] text-slate-500 italic">
                                  {dishAssign.notes}
                                </p>
                              )}

                              {/* Dish Tags (Issue #7) */}
                              {(() => {
                                const fullDish = dishes?.find((d) => d.id === dishAssign.dish_id)
                                if (!fullDish?.tags || fullDish.tags.length === 0) return null
                                return (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {fullDish.tags.map((tg) => (
                                      <span
                                        key={tg.id || tg.name}
                                        className="text-[9px] font-semibold text-white px-1.5 py-0.2 rounded-full shadow-2xs"
                                        style={{ backgroundColor: tg.color || '#16a34a' }}
                                      >
                                        {tg.name}
                                      </span>
                                    ))}
                                  </div>
                                )
                              })()}
                            </div>
                            <button
                              onClick={() => onRemoveDish(slot.id, dishAssign.dish_id)}
                              className="text-slate-400 hover:text-rose-500 text-xs px-1 rounded transition-colors"
                              title={t('today.remove_dish_title')}
                            >
                              ✕
                            </button>
                          </div>

                          {/* Smart Compatibility Alert */}
                          {comp.status === 'warning' && (
                            <div className="flex items-center space-x-1 p-1 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                              <AlertTriangle className="w-3 h-3 flex-shrink-0 text-amber-600" />
                              <span className="font-medium">{getLocalizedCompatibilityMessage(comp, t)}</span>
                            </div>
                          )}

                          {comp.status === 'hit' && (
                            <div className="flex items-center space-x-1 p-1 rounded bg-pink-50 border border-pink-200 text-pink-800 text-[11px]">
                              <Star className="w-3 h-3 flex-shrink-0 text-pink-600 fill-pink-500" />
                              <span className="font-medium">{getLocalizedCompatibilityMessage(comp, t)}</span>
                            </div>
                          )}

                          {comp.status === 'ok' && !comp.is_conflict && (
                            <div className="flex items-center space-x-1 text-emerald-700 text-[10px]">
                              <CheckCircle className="w-2.5 h-2.5" />
                              <span>{t('today.all_ok_compatibility')}</span>
                            </div>
                          )}

                          {/* J002 / J003: Valutazione facoltativa per questo specifico pasto */}
                          <div className="pt-1.5 border-t border-slate-100 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                                {t('today.meal_rating')}
                              </span>
                              <span className="text-[9px] text-slate-400">
                                {t('today.meal_rating_sub')}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {members.map((m) => {
                                const mealRatingObj = dishAssign.ratings?.find((r) => r.member_id === m.id)
                                const currentMealRating = mealRatingObj?.rating
                                const isThumbsUp = currentMealRating === 'thumbs_up'
                                const isNeutral = currentMealRating === 'neutral'
                                const isThumbsDown = currentMealRating === 'thumbs_down'

                                const handleToggleRating = (targetRating: 'thumbs_up' | 'neutral' | 'thumbs_down') => {
                                  if (currentMealRating === targetRating) {
                                    onDeleteSlotDishRating(slot.id, dishAssign.dish_id, m.id)
                                  } else {
                                    onSetSlotDishRating(slot.id, dishAssign.dish_id, m.id, targetRating)
                                  }
                                }

                                return (
                                  <div
                                    key={m.id}
                                    className={`flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] border transition-colors ${
                                      isThumbsDown
                                        ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-200'
                                        : isThumbsUp
                                        ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200'
                                        : isNeutral
                                        ? 'bg-slate-100 border-slate-300'
                                        : 'bg-slate-50 border-slate-200/80'
                                    }`}
                                  >
                                    <span
                                      className="w-2 h-2 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: m.avatar_color || '#3B82F6' }}
                                    />
                                    <span className="font-medium text-slate-800 text-[10px]">{m.name}:</span>

                                    {/* 3 State Toggle Buttons */}
                                    <div className="flex items-center rounded border border-slate-200 overflow-hidden bg-white">
                                      {/* Piace (👍) */}
                                      <button
                                        type="button"
                                        onClick={() => handleToggleRating('thumbs_up')}
                                        title={t('today.rating_liked_title', { name: m.name })}
                                        className={`px-1.5 py-0.5 flex items-center transition-all text-[10px] ${
                                          isThumbsUp
                                            ? 'bg-emerald-600 text-white font-bold ring-1 ring-emerald-600'
                                            : 'text-slate-400 hover:text-emerald-700 hover:bg-emerald-50'
                                        }`}
                                      >
                                        <ThumbsUp className="w-3 h-3" />
                                      </button>

                                      {/* Neutro (😐) */}
                                      <button
                                        type="button"
                                        onClick={() => handleToggleRating('neutral')}
                                        title={t('today.rating_neutral_title', { name: m.name })}
                                        className={`px-1.5 py-0.5 flex items-center transition-all text-[10px] ${
                                          isNeutral
                                            ? 'bg-slate-600 text-white font-bold ring-1 ring-slate-600'
                                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                                        }`}
                                      >
                                        <Meh className="w-3 h-3" />
                                      </button>

                                      {/* Non piace (👎) */}
                                      <button
                                        type="button"
                                        onClick={() => handleToggleRating('thumbs_down')}
                                        title={t('today.rating_disliked_title', { name: m.name })}
                                        className={`px-1.5 py-0.5 flex items-center transition-all text-[10px] ${
                                          isThumbsDown
                                            ? 'bg-rose-600 text-white font-bold ring-1 ring-rose-600'
                                            : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                        }`}
                                      >
                                        <ThumbsDown className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {/* Notes List for this consumption */}
                          <div className="pt-1 border-t border-slate-100 space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span className="flex items-center space-x-1">
                                <MessageSquare className="w-2.5 h-2.5" />
                                <span>{t('today.notes_count', { count: dishAssign.notes_list?.length || 0 })}</span>
                              </span>
                              {!isAddingNote && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveNoteDishId({ slotId: slot.id, dishId: dishAssign.dish_id })
                                    setNoteText('')
                                  }}
                                  className="text-brand-600 hover:text-brand-700 font-medium"
                                >
                                  {t('today.add_note')}
                                </button>
                              )}
                            </div>

                            {dishAssign.notes_list && dishAssign.notes_list.length > 0 && (
                              <div className="space-y-0.5">
                                {dishAssign.notes_list.map((n) => (
                                  <div
                                    key={n.id}
                                    className="p-1 rounded bg-slate-50 border border-slate-200/60 flex items-start justify-between text-[11px]"
                                  >
                                    <p className="text-slate-700 whitespace-pre-wrap flex-1">{n.note}</p>
                                    <button
                                      type="button"
                                      onClick={() => onDeleteSlotDishNote(slot.id, dishAssign.dish_id, n.id)}
                                      className="text-slate-400 hover:text-rose-500 ml-1 p-0.5"
                                      title={t('today.delete_note_title')}
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Inline Add Note Input */}
                            {isAddingNote && (
                              <div className="flex items-center space-x-1 pt-0.5">
                                <input
                                  type="text"
                                  autoFocus
                                  value={noteText}
                                  onChange={(e) => setNoteText(e.target.value)}
                                  placeholder={t('today.note_placeholder')}
                                  className="flex-1 px-2 py-0.5 text-[11px] rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      handleSaveNote(slot.id, dishAssign.dish_id)
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveNote(slot.id, dishAssign.dish_id)}
                                  className="px-2 py-0.5 bg-brand-600 text-white font-medium text-[11px] rounded hover:bg-brand-700"
                                >
                                  {t('today.save')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActiveNoteDishId(null)}
                                  className="px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 text-[11px] rounded"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </div>
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
