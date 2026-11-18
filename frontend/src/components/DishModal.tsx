import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dish,
  DishPayload,
  CourseType,
  DishStatus,
  SourceType,
} from '../types'
import { DishTagSelector, SelectedTagItem } from './DishTagSelector'
import { getLocalizedCourseName, getLocalizedStatusName } from '../taxonomyUtils'
import { ThumbsUp, Meh, ThumbsDown, X } from 'lucide-react'

export interface DishModalProps {
  isOpen: boolean
  onClose: () => void
  dish: Dish | null
  courses: CourseType[]
  statuses: DishStatus[]
  sources?: SourceType[]
  availableTags?: Array<{ id?: number; name: string; color: string }>
  dishes: Dish[]
  onSave: (payload: DishPayload, dishId?: number) => Promise<void>
  onSetPreference?: (dishId: number, memberId: number, rating: 'favorite' | 'neutral' | 'dislike') => Promise<void>
}

export const DishModal: React.FC<DishModalProps> = ({
  isOpen,
  onClose,
  dish,
  courses,
  statuses,
  sources = [],
  availableTags = [],
  dishes,
  onSave,
  onSetPreference,
}) => {
  const { t } = useTranslation()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [statusId, setStatusId] = useState<number>(1)
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([])
  const [formTags, setFormTags] = useState<SelectedTagItem[]>([])
  const [sourceTypeId, setSourceTypeId] = useState<number | undefined>(undefined)
  const [sourceReference, setSourceReference] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const sortedStatuses = [...statuses].sort((a, b) => a.id - b.id)
  const sortedCourses = [...courses].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

  const getDefaultStatusId = () => {
    const defaultStatus = statuses.find((s) => s.is_default)
    return defaultStatus ? defaultStatus.id : statuses[0]?.id || 1
  }

  useEffect(() => {
    if (!isOpen) return

    if (dish) {
      setTitle(dish.title)
      setDescription(dish.description || '')
      setNotes(dish.notes || '')
      setStatusId(dish.status.id)
      setSelectedCourseIds(dish.courses.map((c) => c.id))
      setFormTags(dish.tags ? dish.tags.map((t) => ({ id: t.id, name: t.name, color: t.color })) : [])
      setSourceTypeId(dish.source.source_type_id || undefined)
      setSourceReference(dish.source.source_reference || '')
      setSourceUrl(dish.source.source_url || '')
      setFormError(null)
    } else {
      setTitle('')
      setDescription('')
      setNotes('')
      setStatusId(getDefaultStatusId())
      setSelectedCourseIds(courses.length > 0 ? [courses[0].id] : [])
      setFormTags([])
      setSourceTypeId(undefined)
      setSourceReference('')
      setSourceUrl('')
      setFormError(null)
    }
  }, [isOpen, dish, statuses, courses])

  if (!isOpen) return null

  const handleToggleCourse = (courseId: number) => {
    if (selectedCourseIds.includes(courseId)) {
      if (selectedCourseIds.length > 1) {
        setSelectedCourseIds(selectedCourseIds.filter((id) => id !== courseId))
      }
    } else {
      setSelectedCourseIds([...selectedCourseIds, courseId])
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setFormError(t('dishes.error_title_required', 'Il titolo è obbligatorio'))
      setSubmitting(false)
      return
    }

    if (selectedCourseIds.length === 0) {
      setFormError(t('dishes.error_select_course', 'Seleziona almeno una portata'))
      setSubmitting(false)
      return
    }

    // Check duplicate dish name
    const duplicateDish = dishes.find(
      (d) =>
        d.title.trim().toLowerCase() === trimmedTitle.toLowerCase() &&
        (!dish || d.id !== dish.id)
    )
    if (duplicateDish) {
      setFormError(t('dishes.error_duplicate_name'))
      setSubmitting(false)
      return
    }

    try {
      const payload: DishPayload = {
        title: trimmedTitle,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        status_id: statusId,
        course_ids: selectedCourseIds,
        tags: formTags.map((t) => ({ name: t.name, color: t.color })),
        source_type_id: sourceTypeId,
        source_reference: sourceReference.trim() || undefined,
        source_url: sourceUrl.trim() || undefined,
      }

      await onSave(payload, dish ? dish.id : undefined)
      onClose()
    } catch (err: any) {
      setFormError(err.message || 'Errore nel salvataggio')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-xl p-5 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-3.5 shadow-xl">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="font-bold text-base sm:text-lg text-slate-900">
            {dish ? t('dishes.modal_edit_title') : t('dishes.modal_new_title')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && (
          <div className="p-2.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-medium">
            {formError}
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-3.5">
          {/* Titolo */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {t('dishes.dish_title')}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTitle((prev) => prev.trim())}
              placeholder={t('dishes.dish_title_placeholder')}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs sm:text-sm"
            />
          </div>

          {/* Portate (Multi-Course Selection) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {t('dishes.dish_courses')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {sortedCourses.map((c) => {
                const isSelected = selectedCourseIds.includes(c.id)
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => handleToggleCourse(c.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-brand-600 text-white border-brand-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {getLocalizedCourseName(c.name, t)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Descrizione / Breve Ricetta (TRA PORTATE E STATO DI GRADIMENTO) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {t('dishes.dish_description')}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('dishes.dish_description_placeholder')}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs sm:text-sm"
            />
          </div>

          {/* Stato di Gradimento */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {t('dishes.dish_status')} *
            </label>
            <select
              value={statusId}
              onChange={(e) => setStatusId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs sm:text-sm bg-white font-medium cursor-pointer"
            >
              {sortedStatuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {getLocalizedStatusName(s, t)}
                </option>
              ))}
            </select>
          </div>

          {/* Fonte Ricetta */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2.5">
            <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block">
              {t('dishes.dish_source_type')}
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">{t('dishes.dish_source_type')}</label>
                <select
                  value={sourceTypeId !== undefined ? sourceTypeId : ''}
                  onChange={(e) => {
                    const val = e.target.value
                    setSourceTypeId(val === '' ? undefined : Number(val))
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white cursor-pointer"
                >
                  <option value="">-- Nessuna fonte --</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-1">
                  Dettaglio Fonte (Pagina, Libro, Persona)
                </label>
                <input
                  type="text"
                  value={sourceReference}
                  onChange={(e) => setSourceReference(e.target.value)}
                  placeholder="es. Il Cucchiaio d'Argento p. 112"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 mb-1">
                Link Web o Social (URL)
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
            </div>
          </div>

          {/* Tags Selector */}
          <DishTagSelector
            selectedTags={formTags}
            availableTags={availableTags}
            onChange={setFormTags}
          />

          {/* Note o Suggerimenti di Preparazione (IN FONDO) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {t('dishes.dish_notes')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('dishes.dish_notes_placeholder')}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs sm:text-sm"
            />
          </div>

          {/* Preferenze Commensali (se si sta modificando un piatto esistente) */}
          {dish && dish.preferences && dish.preferences.length > 0 && onSetPreference && (
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block">
                  {t('dishes.diners_preference_modal_title')}
                </span>
                <span className="text-[10px] text-slate-400">{t('dishes.instant_save')}</span>
              </div>
              <div className="space-y-1">
                {dish.preferences.map((pref) => {
                  const isDisliked = pref.rating === 'dislike'
                  const isFavorite = pref.rating === 'favorite'
                  return (
                    <div
                      key={pref.member_id}
                      className={`flex items-center justify-between text-xs px-2 py-1 rounded bg-white border ${
                        isDisliked ? 'border-rose-200 bg-rose-50/50' : isFavorite ? 'border-sky-200 bg-sky-50/50' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: pref.avatar_color || '#3B82F6' }}
                        />
                        <span className="font-medium text-slate-800">{pref.member_name}</span>
                        {isDisliked && (
                          <span className="text-[9px] font-bold text-rose-700 bg-rose-100 px-1 py-0.2 rounded border border-rose-200">
                            {t('dishes.pref_dislike')}
                          </span>
                        )}
                        {isFavorite && (
                          <span className="text-[9px] font-bold text-sky-700 bg-sky-100 px-1 py-0.2 rounded border border-sky-200">
                            {t('dishes.pref_favorite_btn', 'Piace')}
                          </span>
                        )}
                      </div>
                      <div className="flex rounded border border-slate-200 overflow-hidden bg-slate-50">
                        {/* Piace (Blu sfumato) */}
                        <button
                          type="button"
                          onClick={() => {
                            onSetPreference(dish.id, pref.member_id, 'favorite')
                            pref.rating = 'favorite'
                          }}
                          className={`px-2 py-0.5 text-[10px] flex items-center space-x-1 cursor-pointer ${
                            isFavorite ? 'bg-sky-100 text-sky-800 font-bold' : 'text-slate-500 hover:text-sky-600 hover:bg-sky-50'
                          }`}
                        >
                          <ThumbsUp className={`w-3 h-3 ${isFavorite ? 'fill-sky-500 text-sky-600' : ''}`} />
                          <span>{t('dishes.pref_favorite_btn')}</span>
                        </button>
                        {/* Neutro / OK (Verde) */}
                        <button
                          type="button"
                          onClick={() => {
                            onSetPreference(dish.id, pref.member_id, 'neutral')
                            pref.rating = 'neutral'
                          }}
                          className={`px-2 py-0.5 text-[10px] flex items-center space-x-1 cursor-pointer ${
                            pref.rating === 'neutral'
                              ? 'bg-emerald-100 text-emerald-800 font-bold'
                              : 'text-slate-500 hover:text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          <Meh className="w-3 h-3" />
                          <span>{t('dishes.pref_neutral_btn')}</span>
                        </button>
                        {/* Non piace (Rosso sfumato) */}
                        <button
                          type="button"
                          onClick={() => {
                            onSetPreference(dish.id, pref.member_id, 'dislike')
                            pref.rating = 'dislike'
                          }}
                          className={`px-2 py-0.5 text-[10px] flex items-center space-x-1 cursor-pointer ${
                            isDisliked
                              ? 'bg-rose-100 text-rose-700 font-bold border-l border-rose-200'
                              : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                          }`}
                        >
                          <ThumbsDown className="w-3 h-3" />
                          <span className="font-bold">{t('dishes.pref_dislike')}</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-2 rounded-lg text-xs sm:text-sm text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitting ? t('common.saving') : t('dishes.btn_save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
