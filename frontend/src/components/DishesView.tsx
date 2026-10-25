import React, { useState } from 'react'
import { Dish, DishStatus, CourseType, SourceType } from '../types'
import { Plus, Search, ExternalLink, Book, Star, Meh, Ban, Filter, Trash2 } from 'lucide-react'

interface DishesViewProps {
  dishes: Dish[]
  statuses: DishStatus[]
  courses: CourseType[]
  sources: SourceType[]
  onCreateDish: (payload: {
    title: string
    description?: string
    notes?: string
    status_id: number
    course_ids: number[]
    source_type_id?: number
    source_reference?: string
    source_url?: string
  }) => Promise<void>
  onDeleteDish: (dishId: number) => Promise<void>
  onSetPreference: (dishId: number, memberId: number, rating: 'favorite' | 'neutral' | 'dislike') => Promise<void>
}

export const DishesView: React.FC<DishesViewProps> = ({
  dishes,
  statuses,
  courses,
  sources,
  onCreateDish,
  onDeleteDish,
  onSetPreference,
}) => {
  const [search, setSearch] = useState('')
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<number | null>(null)
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // New Dish Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [statusId, setStatusId] = useState<number>(statuses[0]?.id || 1)
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([courses[0]?.id || 1])
  const [sourceTypeId, setSourceTypeId] = useState<number | undefined>(sources[0]?.id)
  const [sourceReference, setSourceReference] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleToggleCourse = (id: number) => {
    if (selectedCourseIds.includes(id)) {
      if (selectedCourseIds.length > 1) {
        setSelectedCourseIds(selectedCourseIds.filter((c) => c !== id))
      }
    } else {
      setSelectedCourseIds([...selectedCourseIds, id])
    }
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      await onCreateDish({
        title,
        description: description || undefined,
        notes: notes || undefined,
        status_id: statusId,
        course_ids: selectedCourseIds,
        source_type_id: sourceTypeId,
        source_reference: sourceReference || undefined,
        source_url: sourceUrl || undefined,
      })
      setIsModalOpen(false)
      setTitle('')
      setDescription('')
      setNotes('')
      setSourceReference('')
      setSourceUrl('')
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message)
      } else {
        setFormError('Errore durante la creazione del piatto.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Filter dishes client side for instant responsiveness
  const filteredDishes = dishes.filter((dish) => {
    if (search.trim()) {
      const term = search.toLowerCase()
      const matchTitle = dish.title.toLowerCase().includes(term)
      const matchNotes = dish.notes?.toLowerCase().includes(term)
      if (!matchTitle && !matchNotes) return false
    }
    if (selectedStatusFilter && dish.status.id !== selectedStatusFilter) {
      return false
    }
    if (selectedCourseFilter && !dish.courses.some((c) => c.id === selectedCourseFilter)) {
      return false
    }
    return true
  })

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Catalogo Ricette & Piatti</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Salva i piatti collaudati, la lista "Da provare" e dove trovare le ricette
          </p>
        </div>

        <button
          onClick={() => {
            setIsModalOpen(true)
            setFormError(null)
          }}
          className="flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Nuovo Piatto</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca piatto per nome o note..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
          />
        </div>

        {/* Course Filters */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-medium px-2 py-1 flex items-center">
            <Filter className="w-3 h-3 mr-1" /> Portata:
          </span>
          <button
            onClick={() => setSelectedCourseFilter(null)}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedCourseFilter === null
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tutte
          </button>
          {courses.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCourseFilter(c.id)}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedCourseFilter === c.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-medium px-2 py-1">Stato:</span>
          <button
            onClick={() => setSelectedStatusFilter(null)}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedStatusFilter === null
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tutti gli stati
          </button>
          {statuses.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStatusFilter(s.id)}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedStatusFilter === s.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Dishes Cards Grid */}
      {filteredDishes.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <p className="text-slate-500 font-medium">Nessun piatto trovato con i filtri attivi.</p>
          <p className="text-xs text-slate-400 mt-1">
            Aggiungi il tuo primo piatto col pulsante "Nuovo Piatto"!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDishes.map((dish) => (
            <div
              key={dish.id}
              className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-2xs overflow-hidden flex flex-col justify-between p-5 space-y-4"
            >
              <div className="space-y-3">
                {/* Header: Status and Delete */}
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider"
                    style={{
                      backgroundColor: `${dish.status.color}15`,
                      color: dish.status.color,
                    }}
                  >
                    {dish.status.name}
                  </span>

                  <button
                    onClick={() => onDeleteDish(dish.id)}
                    className="text-slate-300 hover:text-rose-500 p-1 rounded transition-colors"
                    title="Elimina piatto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Title & Notes */}
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{dish.title}</h3>
                  {dish.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {dish.description}
                    </p>
                  )}
                </div>

                {/* Course Badges (Multi-Course) */}
                <div className="flex flex-wrap gap-1">
                  {dish.courses.map((c) => (
                    <span
                      key={c.id}
                      className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md"
                    >
                      {c.name}
                    </span>
                  ))}
                </div>

                {/* Recipe Source Link/Reference */}
                {(dish.source.source_reference || dish.source.source_url) && (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center space-x-1.5 truncate">
                      <Book className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">
                        {dish.source.source_reference || dish.source.source_type_name || 'Ricetta'}
                      </span>
                    </div>

                    {dish.source.source_url && (
                      <a
                        href={dish.source.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 text-brand-600 hover:text-brand-700 font-semibold ml-2 flex-shrink-0"
                      >
                        <span>Apri link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Per-Member Preferences Matrix */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Gradimento in famiglia:
                </span>
                <div className="space-y-1.5">
                  {dish.preferences.map((pref) => (
                    <div
                      key={pref.member_id}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: pref.avatar_color || '#3B82F6' }}
                        />
                        <span className="text-slate-700 font-medium">{pref.member_name}</span>
                      </div>

                      {/* 3-State Toggle: favorite, neutral (default), dislike */}
                      <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50 p-0.5">
                        <button
                          type="button"
                          onClick={() => onSetPreference(dish.id, pref.member_id, 'favorite')}
                          title="Piace molto"
                          className={`p-1 rounded flex items-center space-x-0.5 transition-colors ${
                            pref.rating === 'favorite'
                              ? 'bg-pink-100 text-pink-700 font-bold'
                              : 'text-slate-400 hover:text-pink-600'
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${pref.rating === 'favorite' ? 'fill-pink-500' : ''}`} />
                        </button>

                        <button
                          type="button"
                          onClick={() => onSetPreference(dish.id, pref.member_id, 'neutral')}
                          title="Va bene (default)"
                          className={`p-1 rounded flex items-center space-x-0.5 transition-colors ${
                            pref.rating === 'neutral'
                              ? 'bg-emerald-100 text-emerald-800 font-bold'
                              : 'text-slate-400 hover:text-emerald-700'
                          }`}
                        >
                          <Meh className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onSetPreference(dish.id, pref.member_id, 'dislike')}
                          title="Non piace"
                          className={`p-1 rounded flex items-center space-x-0.5 transition-colors ${
                            pref.rating === 'dislike'
                              ? 'bg-rose-100 text-rose-700 font-bold'
                              : 'text-slate-400 hover:text-rose-600'
                          }`}
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Nuovo Piatto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">Aggiungi Nuovo Piatto</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nome Piatto *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="es. Risotto alla milanese"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                />
              </div>

              {/* Multi-Course Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tipi di Portata (Seleziona uno o più) *
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {courses.map((c) => {
                    const isSelected = selectedCourseIds.includes(c.id)
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => handleToggleCourse(c.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-brand-600 text-white border-brand-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {c.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Stato del Piatto *
                </label>
                <select
                  value={statusId}
                  onChange={(e) => setStatusId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
                >
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Recipe Source */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Dov'è la Ricetta?
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Tipo Fonte</label>
                    <select
                      value={sourceTypeId}
                      onChange={(e) => setSourceTypeId(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                    >
                      {sources.map((src) => (
                        <option key={src.id} value={src.id}>
                          {src.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Riferimento (Libro, Pagina, Note)
                    </label>
                    <input
                      type="text"
                      value={sourceReference}
                      onChange={(e) => setSourceReference(e.target.value)}
                      placeholder="es. Il Cucchiaio d'Argento p. 112"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Link Web o Social (URL)
                  </label>
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://... o link a reel Instagram"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Note o Suggerimenti di Preparazione
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="es. Fare tostare bene il riso, variante senza burro..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-100"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 shadow-sm"
                >
                  {submitting ? 'Salvataggio...' : 'Salva Piatto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
