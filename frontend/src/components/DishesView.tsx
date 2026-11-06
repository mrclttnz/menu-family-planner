import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dish, DishStatus, CourseType, SourceType, SlotDishNote, DishImportResult } from '../types'
import { api } from '../api'
import { getLocalizedStatusName, getLocalizedCourseName, getLocalizedSourceName } from '../taxonomyUtils'
import {
  Plus,
  Search,
  ExternalLink,
  Book,
  Meh,
  ThumbsUp,
  ThumbsDown,
  Filter,
  Trash2,
  Edit2,
  MessageSquare,
  Calendar,
  X,
  Loader2,
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  FileCode,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileCheck,
  ChevronsRight,
  ChevronsLeft,
} from 'lucide-react'

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
  }) => Promise<any>
  onUpdateDish: (dishId: number, payload: {
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
  onRefreshDishes?: () => Promise<void> | void
}

export const DishesView: React.FC<DishesViewProps> = ({
  dishes,
  statuses,
  courses,
  sources,
  onCreateDish,
  onUpdateDish,
  onDeleteDish,
  onSetPreference,
  onRefreshDishes,
}) => {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<number | null>(null)
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<number | null>(null)

  // Modal State (Create & Edit)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDish, setEditingDish] = useState<Dish | null>(null)

  // History Notes Drawer/Modal
  const [historyDish, setHistoryDish] = useState<Dish | null>(null)
  const [historyNotes, setHistoryNotes] = useState<SlotDishNote[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [statusId, setStatusId] = useState<number>(1)
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([])
  const [sourceTypeId, setSourceTypeId] = useState<number | undefined>(undefined)
  const [sourceReference, setSourceReference] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Export & Import State (Issue #2)
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importMode, setImportMode] = useState<'skip' | 'update'>('skip')
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<DishImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  // Compact / Expand Card State (Issue #10)
  const [expandedDishIds, setExpandedDishIds] = useState<Set<number>>(new Set())

  const handleToggleExpand = (dishId: number) => {
    setExpandedDishIds((prev) => {
      const next = new Set(prev)
      if (next.has(dishId)) {
        next.delete(dishId)
      } else {
        next.add(dishId)
      }
      return next
    })
  }

  const handleExpandAll = () => {
    setExpandedDishIds(new Set(filteredDishes.map((d) => d.id)))
  }

  const handleCollapseAll = () => {
    setExpandedDishIds(new Set())
  }

  const handleExport = async (format: 'xlsx' | 'csv' | 'json') => {
    setIsExportDropdownOpen(false)
    setIsExporting(true)
    try {
      await api.exportDishes(format, {
        status_id: selectedStatusFilter || undefined,
        course_id: selectedCourseFilter || undefined,
        search: search.trim() || undefined,
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore durante l\'esportazione.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadTemplate = async (format: 'xlsx' | 'csv' | 'json') => {
    try {
      await api.downloadImportTemplate(format)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore durante il download del modello.')
    }
  }

  const handleExecuteImport = async () => {
    if (!importFile) {
      setImportError('Seleziona un file Excel (.xlsx), CSV (.csv) o JSON (.json) da importare.')
      return
    }
    setImportError(null)
    setIsImporting(true)
    try {
      const res = await api.importDishes(importFile, importMode)
      setImportResult(res)
      if (res.created > 0 || res.updated > 0) {
        await onRefreshDishes?.()
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Errore durante l\'importazione.')
    } finally {
      setIsImporting(false)
    }
  }

  // D001: Sort statuses so default status (OK) is always FIRST in lists and dropdowns
  const sortedStatuses = [...statuses].sort((a, b) => {
    if (a.is_default && !b.is_default) return -1
    if (!a.is_default && b.is_default) return 1
    return 0
  })

  // D001: Get the default status: first status with is_default === true, fallback to statuses[0]
  const getDefaultStatusId = (): number => {
    const defaultStat = statuses.find((s) => s.is_default)
    return defaultStat ? defaultStat.id : statuses[0]?.id || 1
  }

  React.useEffect(() => {
    if (statuses.length > 0 && !editingDish) {
      setStatusId(getDefaultStatusId())
    }
  }, [statuses, editingDish])

  const handleOpenCreate = () => {
    setEditingDish(null)
    setTitle('')
    setDescription('')
    setNotes('')
    setStatusId(getDefaultStatusId())
    setSelectedCourseIds([courses[0]?.id || 1])
    setSourceTypeId(undefined) // D002: Optional source type defaults to undefined
    setSourceReference('')
    setSourceUrl('')
    setFormError(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (dish: Dish) => {
    setEditingDish(dish)
    setTitle(dish.title)
    setDescription(dish.description || '')
    setNotes(dish.notes || '')
    setStatusId(dish.status.id)
    setSelectedCourseIds(dish.courses.map((c) => c.id))
    setSourceTypeId(dish.source.source_type_id || undefined)
    setSourceReference(dish.source.source_reference || '')
    setSourceUrl(dish.source.source_url || '')
    setFormError(null)
    setIsModalOpen(true)
  }

  const handleOpenHistory = async (dish: Dish) => {
    setHistoryDish(dish)
    setLoadingHistory(true)
    try {
      const notesData = await api.getDishNotes(dish.id)
      setHistoryNotes(notesData)
    } catch (err) {
      console.error('Failed to load dish notes:', err)
      setHistoryNotes([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleToggleCourse = (id: number) => {
    if (selectedCourseIds.includes(id)) {
      if (selectedCourseIds.length > 1) {
        setSelectedCourseIds(selectedCourseIds.filter((c) => c !== id))
      }
    } else {
      setSelectedCourseIds([...selectedCourseIds, id])
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        status_id: statusId,
        course_ids: selectedCourseIds,
        source_type_id: sourceTypeId || undefined,
        source_reference: sourceReference.trim() || undefined,
        source_url: sourceUrl.trim() || undefined,
      }

      if (editingDish) {
        await onUpdateDish(editingDish.id, payload)
      } else {
        await onCreateDish(payload)
      }
      setIsModalOpen(false)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message)
      } else {
        setFormError('Errore durante il salvataggio del piatto.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Client-side filter
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
    <div className="space-y-2.5 pb-16 md:pb-4">
      {/* Top Bar (G002: super compact padding) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">{t('dishes.catalog_title')}</h2>
          <p className="text-[11px] text-slate-500">
            {t('dishes.dishes_count', { count: dishes.length })}
          </p>
        </div>

        <div className="flex items-center space-x-1.5 self-start sm:self-auto flex-wrap gap-y-1.5">
          {/* Expand / Collapse All (Issue #10) */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={handleExpandAll}
              className="flex items-center space-x-1 px-2 py-1 text-slate-700 hover:text-brand-700 hover:bg-slate-50 text-xs font-semibold rounded transition-colors cursor-pointer"
              title={t('dishes.btn_expand_all')}
            >
              <ChevronsRight className="w-3.5 h-3.5 text-brand-600" />
              <span>{t('dishes.btn_expand_all')}</span>
            </button>
            <div className="h-3.5 w-px bg-slate-200 mx-0.5" />
            <button
              type="button"
              onClick={handleCollapseAll}
              className="flex items-center space-x-1 px-2 py-1 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold rounded transition-colors cursor-pointer"
              title={t('dishes.btn_collapse_all')}
            >
              <ChevronsLeft className="w-3.5 h-3.5 text-slate-500" />
              <span>{t('dishes.btn_collapse_all')}</span>
            </button>
          </div>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              disabled={isExporting}
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
              title="Export"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
              ) : (
                <Download className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span>{t('dishes.btn_export', { count: filteredDishes.length })}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isExportDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setIsExportDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95">
                  <button
                    onClick={() => handleExport('xlsx')}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{t('dishes.export_excel')}</span>
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t('dishes.export_csv')}</span>
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                  >
                    <FileCode className="w-3.5 h-3.5 text-amber-600" />
                    <span>{t('dishes.export_json')}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Import Button */}
          <button
            onClick={() => {
              setIsImportModalOpen(true)
              setImportResult(null)
              setImportFile(null)
              setImportError(null)
            }}
            className="flex items-center space-x-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            title="Import"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span>{t('dishes.btn_import')}</span>
          </button>

          {/* New Dish Button */}
          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center space-x-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('dishes.btn_new_dish')}</span>
          </button>
        </div>
      </div>

      {/* Filters & Search (G002: compact) */}
      <div className="bg-white rounded-lg p-2 border border-slate-200 shadow-2xs space-y-1.5">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('dishes.search_placeholder')}
            className="w-full pl-8 pr-2.5 py-1 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 text-xs"
          />
        </div>

        {/* Course Filters */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-0.5 text-xs">
          <span className="text-slate-400 font-medium px-1.5 flex items-center text-[11px]">
            <Filter className="w-3 h-3 mr-1" /> {t('dishes.dish_courses')}:
          </span>
          <button
            onClick={() => setSelectedCourseFilter(null)}
            className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap transition-colors text-xs ${
              selectedCourseFilter === null
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t('common.all')}
          </button>
          {courses.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCourseFilter(c.id)}
              className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap transition-colors text-xs ${
                selectedCourseFilter === c.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {getLocalizedCourseName(c.name, t)}
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-0.5 text-xs">
          <span className="text-slate-400 font-medium px-1.5 text-[11px]">{t('dishes.dish_status')}:</span>
          <button
            onClick={() => setSelectedStatusFilter(null)}
            className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap transition-colors text-xs ${
              selectedStatusFilter === null
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t('common.all')}
          </button>
          {statuses.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStatusFilter(s.id)}
              className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap transition-colors text-xs ${
                selectedStatusFilter === s.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {getLocalizedStatusName(s, t)}
            </button>
          ))}
        </div>
      </div>

      {/* Dishes Cards Grid (G002: 4-5 columns on large screens, compact padding) */}
      {filteredDishes.length === 0 ? (
        <div className="bg-white rounded-lg p-6 text-center border border-slate-200">
          <p className="text-slate-500 font-medium text-xs sm:text-sm">{t('dishes.no_dishes_found')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
          {filteredDishes.map((dish) => {
            const isExpanded = expandedDishIds.has(dish.id)
            return (
              <div
                key={dish.id}
                className="bg-white rounded-lg border border-slate-200 hover:border-slate-300 shadow-2xs overflow-hidden flex flex-col justify-between p-2.5 space-y-2 transition-all"
              >
                <div className="space-y-1.5">
                  {/* Header: Status, Edit & Delete, Expand/Collapse Toggle */}
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full uppercase tracking-wider"
                      style={{
                        backgroundColor: `${dish.status.color}15`,
                        color: dish.status.color,
                      }}
                    >
                      {getLocalizedStatusName(dish.status, t)}
                    </span>

                    <div className="flex items-center space-x-1">
                      {/* G001/D004: Edit Button */}
                      <button
                        onClick={() => handleOpenEdit(dish)}
                        className="text-slate-400 hover:text-brand-600 p-1 rounded transition-colors"
                        title={t('common.edit')}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {/* Delete Button */}
                      <button
                        onClick={() => onDeleteDish(dish.id)}
                        className="text-slate-300 hover:text-rose-500 p-1 rounded transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {/* Expand / Collapse Button (Issue #10) */}
                      <button
                        type="button"
                        onClick={() => handleToggleExpand(dish.id)}
                        className={`flex items-center justify-center px-1.5 py-0.5 rounded text-[11px] font-bold tracking-tight transition-colors cursor-pointer ${
                          isExpanded
                            ? 'bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/80'
                        }`}
                        title={isExpanded ? t('dishes.btn_collapse_dish') : t('dishes.btn_expand_dish')}
                      >
                        <span>{isExpanded ? '<<' : '>>'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Title & (if expanded) Notes / Description */}
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm leading-snug">{dish.title}</h3>
                    {isExpanded && (
                      <>
                        {dish.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                            {dish.description}
                          </p>
                        )}
                        {dish.notes && !dish.description && (
                          <p className="text-[11px] text-slate-400 italic mt-0.5 line-clamp-2">
                            {dish.notes}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Course Badges */}
                  <div className="flex flex-wrap gap-1">
                    {dish.courses.map((c) => (
                      <span
                        key={c.id}
                        className="text-[10px] font-medium bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded"
                      >
                        {getLocalizedCourseName(c.name, t)}
                      </span>
                    ))}
                  </div>

                  {/* Attributes visible only when expanded */}
                  {isExpanded && (
                    <>
                      {/* Recipe Source Link/Reference */}
                      {(dish.source.source_reference || dish.source.source_url) && (
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs text-slate-600">
                          <div className="flex items-center space-x-1.5 truncate text-[11px]">
                            <Book className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            <span className="truncate">
                              {dish.source.source_reference || (dish.source.source_type_name ? getLocalizedSourceName(dish.source.source_type_name, t) : 'Ricetta')}
                            </span>
                          </div>

                          {dish.source.source_url && (
                            <a
                              href={dish.source.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center space-x-0.5 text-brand-600 hover:text-brand-700 font-semibold ml-1.5 flex-shrink-0 text-[11px]"
                            >
                              <span>Link</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* J001: Historical Notes Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenHistory(dish)}
                        className="w-full flex items-center justify-center space-x-1.5 py-1 px-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-[11px] font-medium text-slate-600 hover:text-brand-700 transition-colors"
                      >
                        <MessageSquare className="w-3 h-3 text-brand-600" />
                        <span>{t('dishes.meal_notes_history')}</span>
                      </button>
                    </>
                  )}
                </div>

                {/* Per-Member Preferences Matrix (visible only when expanded) */}
                {isExpanded && (
                  <div className="pt-1.5 border-t border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                        {t('dishes.diners_preference_label')}
                      </span>
                      <span className="text-[9px] text-slate-400">
                        {t('dishes.diners_preference_legend')}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {dish.preferences.map((pref) => {
                        const isDisliked = pref.rating === 'dislike'
                        const isFavorite = pref.rating === 'favorite'

                        return (
                          <div
                            key={pref.member_id}
                            className={`flex items-center justify-between text-xs px-1.5 py-0.5 rounded transition-colors ${
                              isDisliked ? 'bg-rose-50 border border-rose-200' : ''
                            }`}
                          >
                            <div className="flex items-center space-x-1 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: pref.avatar_color || '#3B82F6' }}
                              />
                              <span className="text-slate-700 font-medium text-[11px] truncate">{pref.member_name}</span>
                              {isDisliked && (
                                <span className="text-[9px] font-bold text-rose-700 bg-rose-100 px-1 py-0.2 rounded">
                                  {t('dishes.pref_dislike')}
                                </span>
                              )}
                            </div>

                            {/* 3-State Toggle: favorite, neutral, dislike */}
                            <div className="flex rounded border border-slate-200 overflow-hidden bg-slate-50">
                              <button
                                type="button"
                                onClick={() => onSetPreference(dish.id, pref.member_id, 'favorite')}
                                title={t('dishes.pref_favorite_tooltip', { name: pref.member_name })}
                                className={`px-1.5 py-0.5 flex items-center transition-colors ${
                                  isFavorite
                                    ? 'bg-pink-100 text-pink-700 font-bold'
                                    : 'text-slate-400 hover:text-pink-600'
                                }`}
                              >
                                <ThumbsUp className={`w-3 h-3 ${isFavorite ? 'fill-pink-500' : ''}`} />
                              </button>

                              <button
                                type="button"
                                onClick={() => onSetPreference(dish.id, pref.member_id, 'neutral')}
                                title={t('dishes.pref_neutral_tooltip', { name: pref.member_name })}
                                className={`px-1.5 py-0.5 flex items-center transition-colors ${
                                  pref.rating === 'neutral'
                                    ? 'bg-emerald-100 text-emerald-800 font-bold'
                                    : 'text-slate-400 hover:text-emerald-700'
                                }`}
                              >
                                <Meh className="w-3 h-3" />
                              </button>

                              <button
                                type="button"
                                onClick={() => onSetPreference(dish.id, pref.member_id, 'dislike')}
                                title={t('dishes.pref_dislike_tooltip', { name: pref.member_name })}
                                className={`px-1.5 py-0.5 flex items-center space-x-0.5 transition-colors ${
                                  isDisliked
                                    ? 'bg-rose-600 text-white font-bold'
                                    : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                }`}
                              >
                                <ThumbsDown className="w-3 h-3" />
                                <span className="text-[9px] font-bold">{t('dishes.pref_dislike')}</span>
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Nuovo / Modifica Piatto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl p-5 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-base sm:text-lg text-slate-900">
                {editingDish ? t('dishes.modal_edit_title') : t('dishes.modal_new_title')}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-2.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  {t('dishes.dish_title')}
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('dishes.dish_title_placeholder')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs sm:text-sm"
                />
              </div>

              {/* Multi-Course Selection */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  {t('dishes.dish_courses')}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {courses.map((c) => {
                    const isSelected = selectedCourseIds.includes(c.id)
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => handleToggleCourse(c.id)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
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

              {/* Status */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  {t('dishes.dish_status')} *
                </label>
                <select
                  value={statusId}
                  onChange={(e) => setStatusId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs sm:text-sm bg-white font-medium"
                >
                  {sortedStatuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {getLocalizedStatusName(s, t)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Recipe Source */}
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
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                    >
                      <option value="">-- {t('common.none')} --</option>
                      {sources.map((src) => (
                        <option key={src.id} value={src.id}>
                          {getLocalizedSourceName(src.name, t)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">
                      Riferimento (Libro, Pagina, Note)
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

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Note o Suggerimenti di Preparazione
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="es. Tostare bene il riso, variante con brodo vegetale..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs sm:text-sm"
                />
              </div>

              {/* If editing, allow setting member preferences right inside the modal */}
              {editingDish && (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block">
                      {t('dishes.diners_preference_modal_title')}
                    </span>
                    <span className="text-[10px] text-slate-400">{t('dishes.instant_save')}</span>
                  </div>
                  <div className="space-y-1">
                    {editingDish.preferences.map((pref) => {
                      const isDisliked = pref.rating === 'dislike'
                      const isFavorite = pref.rating === 'favorite'
                      return (
                        <div
                          key={pref.member_id}
                          className={`flex items-center justify-between text-xs px-2 py-1 rounded bg-white border ${
                            isDisliked ? 'border-rose-300 bg-rose-50/50' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center space-x-1.5">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: pref.avatar_color || '#3B82F6' }}
                            />
                            <span className="font-medium text-slate-800">{pref.member_name}</span>
                            {isDisliked && (
                              <span className="text-[9px] font-bold text-rose-600 bg-rose-100 px-1 py-0.2 rounded">
                                {t('dishes.pref_dislike')}
                              </span>
                            )}
                          </div>
                          <div className="flex rounded border border-slate-200 overflow-hidden bg-slate-50">
                            <button
                              type="button"
                              onClick={() => {
                                onSetPreference(editingDish.id, pref.member_id, 'favorite')
                                pref.rating = 'favorite'
                              }}
                              className={`px-2 py-0.5 text-[10px] flex items-center space-x-1 ${
                                isFavorite ? 'bg-pink-100 text-pink-700 font-bold' : 'text-slate-500 hover:text-pink-600'
                              }`}
                            >
                              <ThumbsUp className="w-3 h-3" />
                              <span>{t('dishes.pref_favorite_btn')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onSetPreference(editingDish.id, pref.member_id, 'neutral')
                                pref.rating = 'neutral'
                              }}
                              className={`px-2 py-0.5 text-[10px] flex items-center space-x-1 ${
                                pref.rating === 'neutral'
                                  ? 'bg-emerald-100 text-emerald-800 font-bold'
                                  : 'text-slate-500 hover:text-emerald-700'
                              }`}
                            >
                              <Meh className="w-3 h-3" />
                              <span>{t('dishes.pref_neutral_btn')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onSetPreference(editingDish.id, pref.member_id, 'dislike')
                                pref.rating = 'dislike'
                              }}
                              className={`px-2 py-0.5 text-[10px] flex items-center space-x-1 ${
                                isDisliked
                                  ? 'bg-rose-600 text-white font-bold'
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

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs sm:text-sm text-slate-600 hover:bg-slate-100"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 shadow-xs"
                >
                  {submitting ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Storico Note Dai Pasti (J001) */}
      {historyDish && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl p-5 max-w-md w-full max-h-[85vh] flex flex-col space-y-3 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-brand-600" />
                <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate">
                  {t('dishes.history_notes_title', { title: historyDish.title })}
                </h3>
              </div>
              <button
                onClick={() => setHistoryDish(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loadingHistory ? (
                <div className="py-8 flex justify-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
                </div>
              ) : historyNotes.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  {t('dishes.no_history_notes')}
                  <br />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    {t('dishes.no_history_notes_help')}
                  </span>
                </p>
              ) : (
                historyNotes.map((n) => (
                  <div
                    key={n.id}
                    className="p-2.5 rounded-lg border border-slate-200/80 bg-slate-50 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">
                        📅 {n.meal_date} ({n.meal_type_name})
                      </span>
                    </div>
                    <p className="text-slate-800 text-xs whitespace-pre-wrap">{n.note}</p>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryDish(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal (Issue #2) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-4 sm:p-5 shadow-xl border border-slate-200 max-h-[92vh] flex flex-col space-y-3 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-brand-50 rounded-lg text-brand-600">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                    Importa Ricette & Piatti
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Carica file Excel (.xlsx), CSV (.csv) o JSON (.json) con campi in inglese
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5 text-xs text-slate-700">
              {importResult ? (
                /* Import Summary Screen */
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-2">
                    <div className="flex items-center space-x-2 text-emerald-800 font-bold text-xs sm:text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Elaborazione completata con successo!</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                      <div className="bg-white p-2 rounded border border-emerald-100">
                        <span className="block text-emerald-700 font-bold text-base">{importResult.created}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Nuovi Piatti</span>
                      </div>
                      <div className="bg-white p-2 rounded border border-emerald-100">
                        <span className="block text-blue-700 font-bold text-base">{importResult.updated}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Aggiornati</span>
                      </div>
                      <div className="bg-white p-2 rounded border border-emerald-100">
                        <span className="block text-slate-600 font-bold text-base">{importResult.skipped}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Ignorati</span>
                      </div>
                    </div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-1.5">
                      <div className="flex items-center space-x-1.5 text-amber-800 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Segnalazioni su righe non importate ({importResult.errors.length}):</span>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1 text-[11px]">
                        {importResult.errors.map((err, i) => (
                          <div key={i} className="p-1.5 bg-white rounded border border-amber-100 text-slate-700">
                            <span className="font-semibold text-amber-800">Riga {err.row}:</span>{' '}
                            {err.dish_title ? <span className="font-medium text-slate-800">[{err.dish_title}] </span> : ''}
                            <span className="text-slate-600">{err.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Import Upload & Config Form */
                <>
                  {/* File Upload Dropzone */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 text-xs">
                      Seleziona File (.xlsx, .csv o .json) <span className="text-rose-500">*</span>
                    </label>
                    <div className="border-2 border-dashed border-slate-200 hover:border-brand-400 rounded-lg p-4 text-center bg-slate-50/60 transition-colors">
                      {importFile ? (
                        <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                          <div className="flex items-center space-x-2 text-left overflow-hidden">
                            {importFile.name.endsWith('.xlsx') ? (
                              <FileSpreadsheet className="w-6 h-6 text-emerald-600 shrink-0" />
                            ) : importFile.name.endsWith('.json') ? (
                              <FileCode className="w-6 h-6 text-amber-600 shrink-0" />
                            ) : (
                              <FileText className="w-6 h-6 text-blue-600 shrink-0" />
                            )}
                            <div className="truncate">
                              <p className="font-semibold text-slate-800 text-xs truncate">{importFile.name}</p>
                              <p className="text-[10px] text-slate-400">
                                {(importFile.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setImportFile(null)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                            title="Rimuovi file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer block">
                          <Upload className="w-7 h-7 mx-auto text-slate-400 mb-1" />
                          <span className="text-xs font-semibold text-brand-600 hover:underline">
                            Scegli un file
                          </span>{' '}
                          <span className="text-xs text-slate-500">oppure trascinalo qui</span>
                          <p className="text-[10px] text-slate-400 mt-1">Formati supportati: Excel (.xlsx), CSV (.csv) e JSON (.json) fino a 5 MB</p>
                          <input
                            type="file"
                            accept=".xlsx,.csv,.json"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setImportFile(e.target.files[0])
                                setImportError(null)
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Duplicate Strategy */}
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <span className="block font-semibold text-slate-800 text-xs">
                      Se un piatto esiste già nel catalogo (stesso titolo):
                    </span>
                    <div className="space-y-1.5">
                      <label className="flex items-start space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'skip'}
                          onChange={() => setImportMode('skip')}
                          className="mt-0.5 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                        <div>
                          <span className="font-medium text-slate-800 text-xs">Salta piatti già presenti</span>
                          <span className="block text-[11px] text-slate-500">
                            I piatti con lo stesso titolo non verranno sovrascritti (consigliato per aggiunte incrementali).
                          </span>
                        </div>
                      </label>
                      <label className="flex items-start space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'update'}
                          onChange={() => setImportMode('update')}
                          className="mt-0.5 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                        <div>
                          <span className="font-medium text-slate-800 text-xs">Aggiorna piatti già presenti</span>
                          <span className="block text-[11px] text-slate-500">
                            I dati del piatto esistente verranno aggiornati con quelli presenti nel file.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Template & Instructions Box */}
                  <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200/80 space-y-1.5 text-[11px] text-slate-600">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <span className="font-semibold text-slate-800">Modelli con intestazioni in inglese:</span>
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleDownloadTemplate('xlsx')}
                          className="text-emerald-700 hover:text-emerald-800 font-semibold hover:underline flex items-center space-x-0.5 cursor-pointer text-[11px]"
                        >
                          <FileSpreadsheet className="w-3 h-3" />
                          <span>Excel</span>
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => handleDownloadTemplate('csv')}
                          className="text-blue-700 hover:text-blue-800 font-semibold hover:underline flex items-center space-x-0.5 cursor-pointer text-[11px]"
                        >
                          <FileText className="w-3 h-3" />
                          <span>CSV</span>
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => handleDownloadTemplate('json')}
                          className="text-amber-700 hover:text-amber-800 font-semibold hover:underline flex items-center space-x-0.5 cursor-pointer text-[11px]"
                        >
                          <FileCode className="w-3 h-3" />
                          <span>JSON</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      • <strong>Campi obbligatori:</strong> <code>title</code>, <code>status</code> (es. <em>OK</em>), <code>courses</code> (es. <em>["Secondo", "Piatto unico"]</em> o <em>Primo</em>).<br />
                      • <strong>Campi facoltativi:</strong> <code>description</code>, <code>notes</code>, <code>source_type</code>, <code>source_reference</code>, <code>source_url</code>.<br />
                      • Le intestazioni e i nomi delle chiavi sono rigorosamente in <strong>inglese</strong>.
                    </p>
                  </div>

                  {importError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start space-x-2 text-rose-700 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{importError}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-2">
              {importResult ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false)
                    setImportResult(null)
                    setImportFile(null)
                  }}
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  {t('common.close')}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    disabled={isImporting}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={!importFile || isImporting}
                    className="flex items-center space-x-1.5 px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-lg shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{t('dishes.importing')}</span>
                      </>
                    ) : (
                      <>
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>{t('dishes.import_btn_start')}</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
