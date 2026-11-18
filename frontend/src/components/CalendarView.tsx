import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MealSlot, Member, MealType, Dish, CourseType, DishStatus } from '../types'
import { formatDate, parseDate } from '../dateUtils'
import {
  getLocalizedMealTypeName,
  getLocalizedStatusName,
  getLocalizedCourseName,
  getLocalizedCompatibilityMessage,
} from '../taxonomyUtils'
import { DishTagSelector, SelectedTagItem } from './DishTagSelector'
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  AlertTriangle,
  Star,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Utensils,
  MessageSquare,
  StickyNote,
  X,
  Users,
  UserX,
  Check,
  Meh,
  ThumbsUp,
  ThumbsDown,
  LayoutGrid,
  Rows3,
  List,
  Search,
  Tag as TagIcon,
  Printer,
  Pencil,
} from 'lucide-react'
import { DishModal } from './DishModal'
import { SourceType, Tag, DishPayload } from '../types'

export type CalendarViewMode = 'compact_h' | 'compact_v' | 'detailed'

interface CalendarViewProps {
  householdName?: string
  slots: MealSlot[]
  members: Member[]
  dishes: Dish[]
  mealTypes: MealType[]
  courses?: CourseType[]
  statuses?: DishStatus[]
  sources?: SourceType[]
  availableTags?: Tag[]
  startDate: string
  endDate: string
  weekStartDay: number
  onChangeWeekStartDay: (day: number) => void
  onResetToCurrentWeek: () => void
  onDateRangeChange: (start: string, end: string) => void
  onAddCustomSlot: (date: string, mealTypeId: number) => void
  onDeleteSlot: (slotId: number) => void
  onDeleteMealTypeSlots?: (mealTypeId: number) => Promise<void>
  onUpdateSlotNotes?: (slotId: number, notes: string | null) => Promise<void>
  onSaveSlotAttendance?: (slotId: number, absentMemberIds: number[]) => Promise<void>
  onAssignDish: (slotId: number, dishId: number, assignedMemberIds?: number[]) => void
  onUpdateSlotDish?: (slotId: number, dishId: number, assignedMemberIds?: number[]) => Promise<void>
  onCreateDish?: (payload: {
    title: string
    description?: string
    notes?: string
    status_id: number
    course_ids: number[]
    tags?: Array<{ name: string; color?: string }>
  }) => Promise<Dish>
  onUpdateDish?: (dishId: number, payload: DishPayload) => Promise<void>
  onSetPreference?: (dishId: number, memberId: number, rating: 'favorite' | 'neutral' | 'dislike') => Promise<void>
  onRemoveDish: (slotId: number, dishId: number) => void
  onAddSlotDishNote: (slotId: number, dishId: number, note: string) => void
  onDeleteSlotDishNote: (slotId: number, dishId: number, noteId: number) => void
  onSetSlotDishRating: (slotId: number, dishId: number, memberId: number, rating: 'thumbs_up' | 'neutral' | 'thumbs_down') => Promise<void>
  onDeleteSlotDishRating: (slotId: number, dishId: number, memberId: number) => Promise<void>
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  householdName,
  slots,
  members,
  dishes,
  mealTypes,
  courses = [],
  statuses = [],
  sources = [],
  availableTags = [],
  startDate,
  endDate,
  weekStartDay,
  onChangeWeekStartDay,
  onResetToCurrentWeek,
  onDateRangeChange,
  onAddCustomSlot,
  onDeleteSlot,
  onDeleteMealTypeSlots,
  onUpdateSlotNotes,
  onSaveSlotAttendance,
  onAssignDish,
  onUpdateSlotDish,
  onCreateDish,
  onRemoveDish,
  onAddSlotDishNote,
  onDeleteSlotDishNote,
  onSetSlotDishRating,
  onDeleteSlotDishRating,
  onUpdateDish,
  onSetPreference,
}) => {
  const { t, i18n } = useTranslation()
  const currentLocale = i18n.language && i18n.language.startsWith('en') ? 'en-US' : 'it-IT'

  // P004 / Issue #13: Switch 3 modalità (Compatta Orizzontale, Compatta Verticale, Dettagliata) - Default su Compatta Verticale
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() => {
    const saved = localStorage.getItem('menu_design_view_mode')
    if (saved === 'detailed') return 'detailed'
    if (saved === 'compact_h') return 'compact_h'
    return 'compact_v' // default is compact vertical
  })

  const handleToggleViewMode = (mode: CalendarViewMode) => {
    setViewMode(mode)
    localStorage.setItem('menu_design_view_mode', mode)
  }

  // Issue #22: Print & Fridge Planner Modal State
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printLayout, setPrintLayout] = useState<'current' | 'fridge'>('current')
  const [printFontSize, setPrintFontSize] = useState<'normal' | 'large' | 'xlarge'>('large')

  const handleTriggerPrint = (selectedLayout: 'current' | 'fridge') => {
    setPrintLayout(selectedLayout)
    setShowPrintModal(false)
    // Small timeout to allow DOM/styles to re-render the chosen print format
    setTimeout(() => {
      window.print()
    }, 150)
  }

  const [selectedSlotForDish, setSelectedSlotForDish] = useState<number | null>(null)
  const [selectedMealTypeForDate, setSelectedMealTypeForDate] = useState<string | null>(null)
  const [newSlotMealTypeId, setNewSlotMealTypeId] = useState<number>(mealTypes[0]?.id || 1)

  // Alternative Dish Diners Selection State (P002)
  const [assignForSpecificMembers, setAssignForSpecificMembers] = useState(false)
  const [selectedMemberIdsForDish, setSelectedMemberIdsForDish] = useState<number[]>([])

  // P007: Dish Search & Course Filter
  const [dishSearch, setDishSearch] = useState('')
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<number | null>(null)
  const [selectedCalendarTagFilters, setSelectedCalendarTagFilters] = useState<string[]>([])

  // P008: Inline Quick Create Dish
  const [isCreatingDish, setIsCreatingDish] = useState(false)
  const [newDishTitle, setNewDishTitle] = useState('')
  const [newDishCourseIds, setNewDishCourseIds] = useState<number[]>([])
  const [newDishDescription, setNewDishDescription] = useState('')
  const [newDishNotes, setNewDishNotes] = useState('')
  const [newDishTags, setNewDishTags] = useState<SelectedTagItem[]>([])
  const [isSavingDish, setIsSavingDish] = useState(false)
  const [createDishError, setCreateDishError] = useState<string | null>(null)

  // Inline Note State (J001)
  const [activeNoteDishId, setActiveNoteDishId] = useState<{ slotId: number; dishId: number } | null>(null)
  const [noteText, setNoteText] = useState('')

  // Meal Slot General Note State (P010)
  const [editingSlotNoteId, setEditingSlotNoteId] = useState<number | null>(null)
  const [editSlotNoteValue, setEditSlotNoteValue] = useState<string>('')

  // Meal Attendance Modal State (Issue #8)
  const [attendanceModalSlot, setAttendanceModalSlot] = useState<MealSlot | null>(null)
  const [draftAbsentIds, setDraftAbsentIds] = useState<Set<number>>(new Set())
  const [isSavingAttendance, setIsSavingAttendance] = useState(false)

  const handleOpenAttendanceModal = (slot: MealSlot) => {
    setAttendanceModalSlot(slot)
    setDraftAbsentIds(new Set(slot.absent_member_ids || []))
  }

  // Edit Slot Dish Diners State (Issue #9)
  const [editingSlotDish, setEditingSlotDish] = useState<{
    slotId: number
    slotDate: string
    mealTypeName: string
    dishId: number
    dishTitle: string
    assignedMemberIds: number[]
  } | null>(null)
  const [editAssignForSpecific, setEditAssignForSpecific] = useState(false)
  const [editSelectedMemberIds, setEditSelectedMemberIds] = useState<number[]>([])
  const [isSavingSlotDish, setIsSavingSlotDish] = useState(false)

  const handleOpenEditSlotDishModal = (
    slot: MealSlot,
    dish: { dish_id: number; dish_title: string; assigned_member_ids?: number[] }
  ) => {
    const hasSpecific = Boolean(dish.assigned_member_ids && dish.assigned_member_ids.length > 0)
    setEditingSlotDish({
      slotId: slot.id,
      slotDate: slot.date,
      mealTypeName: getLocalizedMealTypeName(slot.meal_type, t),
      dishId: dish.dish_id,
      dishTitle: dish.dish_title,
      assignedMemberIds: dish.assigned_member_ids || [],
    })
    setEditAssignForSpecific(hasSpecific)
    setEditSelectedMemberIds(hasSpecific ? [...(dish.assigned_member_ids || [])] : members.map((m) => m.id))
  }

  const handleToggleEditMember = (memberId: number) => {
    if (editSelectedMemberIds.includes(memberId)) {
      setEditSelectedMemberIds(editSelectedMemberIds.filter((id) => id !== memberId))
    } else {
      setEditSelectedMemberIds([...editSelectedMemberIds, memberId])
    }
  }

  const handleSaveEditSlotDish = async () => {
    if (!editingSlotDish) return
    setIsSavingSlotDish(true)
    try {
      const targetMemberIds = editAssignForSpecific ? editSelectedMemberIds : []
      if (onUpdateSlotDish) {
        await onUpdateSlotDish(editingSlotDish.slotId, editingSlotDish.dishId, targetMemberIds)
      } else {
        onAssignDish(editingSlotDish.slotId, editingSlotDish.dishId, targetMemberIds)
      }
      setEditingSlotDish(null)
    } catch (err) {
      console.error('Failed to update dish assignment:', err)
    } finally {
      setIsSavingSlotDish(false)
    }
  }

  // View & Edit Dish Info Modal
  const [editingDishForDetail, setEditingDishForDetail] = useState<Dish | null>(null)

  const handleOpenDishDetail = (dishId: number) => {
    const found = dishes.find((d) => d.id === dishId)
    if (found) {
      setEditingDishForDetail(found)
    }
  }

  const getAttendanceSummary = (absentMemberIds: number[]) => {
    const total = members.length
    if (total === 0) {
      return { text: '', fullTooltip: t('calendar.all_present'), isAllPresent: true }
    }

    const absentSet = new Set(absentMemberIds || [])
    const absentMembers = members.filter((m) => absentSet.has(m.id))
    const presentMembers = members.filter((m) => !absentSet.has(m.id))

    // 1. Tutti presenti: non si scrive nulla, resta solo l'icona
    if (absentMembers.length === 0) {
      return {
        text: '',
        fullTooltip: t('calendar.all_present'),
        isAllPresent: true,
      }
    }

    // Se nessun commensale è presente
    if (presentMembers.length === 0) {
      const text = t('calendar.no_diners')
      return {
        text,
        fullTooltip: text,
        isAllPresent: false,
      }
    }

    // 2. Se presenti < assenti: "solo Tizio" o "solo Tizio, Caio"
    if (presentMembers.length < absentMembers.length) {
      const names = presentMembers.map((m) => m.name).join(', ')
      const text = t('calendar.attendance_only', { names })
      return {
        text,
        fullTooltip: text,
        isAllPresent: false,
      }
    }

    // 3. Se assenti <= presenti: "no Tizio" o "no Tizio, Caio"
    const names = absentMembers.map((m) => m.name).join(', ')
    const text = t('calendar.attendance_no', { names })
    return {
      text,
      fullTooltip: text,
      isAllPresent: false,
    }
  }

  const handleStartEditSlotNote = (slotId: number, currentNote?: string) => {
    setEditingSlotNoteId(slotId)
    setEditSlotNoteValue(currentNote || '')
  }

  const handleSaveSlotNote = async (slotId: number) => {
    if (onUpdateSlotNotes) {
      await onUpdateSlotNotes(slotId, editSlotNoteValue.trim() || null)
    }
    setEditingSlotNoteId(null)
  }

  const handleDeleteSlotNote = async (slotId: number) => {
    if (window.confirm('Sei sicuro di voler eliminare la nota per questo pasto?')) {
      if (onUpdateSlotNotes) {
        await onUpdateSlotNotes(slotId, null)
      }
      if (editingSlotNoteId === slotId) {
        setEditingSlotNoteId(null)
      }
    }
  }

  // Shift 7 days
  const handleShiftDays = (direction: 'prev' | 'next') => {
    const start = parseDate(startDate)
    const offset = direction === 'next' ? 7 : -7
    start.setDate(start.getDate() + offset)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    onDateRangeChange(formatDate(start), formatDate(end))
  }

  const handleOpenAssignModal = (slotId: number) => {
    setSelectedSlotForDish(slotId)
    setAssignForSpecificMembers(false)
    setSelectedMemberIdsForDish([])
    setDishSearch('')
    setSelectedCourseFilter(null)
    setSelectedCalendarTagFilters([])
    setIsCreatingDish(false)
    setNewDishTitle('')
    setNewDishCourseIds([])
    setNewDishDescription('')
    setNewDishNotes('')
    setCreateDishError(null)
  }

  const handleSelectDishForSlot = (dishId: number) => {
    if (!selectedSlotForDish) return
    const assignedIds =
      assignForSpecificMembers && selectedMemberIdsForDish.length > 0 ? selectedMemberIdsForDish : undefined
    onAssignDish(selectedSlotForDish, dishId, assignedIds)
    setSelectedSlotForDish(null)
    setIsCreatingDish(false)
  }

  const handleToggleMemberForDish = (memberId: number) => {
    if (selectedMemberIdsForDish.includes(memberId)) {
      setSelectedMemberIdsForDish(selectedMemberIdsForDish.filter((id) => id !== memberId))
    } else {
      setSelectedMemberIdsForDish([...selectedMemberIdsForDish, memberId])
    }
  }

  const handleStartCreateDish = (prefillTitle?: string) => {
    setIsCreatingDish(true)
    setNewDishTitle((prefillTitle || dishSearch || '').trim())
    setNewDishCourseIds(
      selectedCourseFilter
        ? [selectedCourseFilter]
        : courses && courses.length > 0
          ? [courses[0].id]
          : []
    )
    setNewDishDescription('')
    setNewDishNotes('')
    // Prefill tags if any tag filters were active in calendar dish picker
    const prefilledTags: SelectedTagItem[] = selectedCalendarTagFilters.map((tagName) => {
      const match = calendarAvailableTags.find((t) => t.name.toLowerCase() === tagName.toLowerCase())
      return {
        id: match?.id,
        name: tagName,
        color: match?.color || '#16a34a',
      }
    })
    setNewDishTags(prefilledTags)
    setCreateDishError(null)
  }

  const handleToggleCourseForNewDish = (courseId: number) => {
    if (newDishCourseIds.includes(courseId)) {
      setNewDishCourseIds(newDishCourseIds.filter((id) => id !== courseId))
    } else {
      setNewDishCourseIds([...newDishCourseIds, courseId])
    }
  }

  const handleQuickCreateDishSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedTitle = newDishTitle.trim()
    if (!trimmedTitle) {
      setCreateDishError(t('dishes.error_title_required'))
      return
    }

    if (newDishCourseIds.length === 0) {
      setCreateDishError(t('dishes.error_courses_required'))
      return
    }

    // Issue #17: Prevent duplicate dish name (case-insensitive & whitespace trimmed)
    const normalizedNewTitle = trimmedTitle.toLowerCase()
    const duplicateDish = dishes.find(
      (d) => d.title.trim().toLowerCase() === normalizedNewTitle
    )
    if (duplicateDish) {
      setCreateDishError(t('dishes.error_duplicate_name'))
      return
    }

    if (!selectedSlotForDish) return

    setIsSavingDish(true)
    setCreateDishError(null)
    try {
      const defaultStatus = statuses?.find((s) => s.is_default) || statuses?.[0]
      const statusId = defaultStatus?.id || 1

      if (onCreateDish) {
        const created = await onCreateDish({
          title: trimmedTitle,
          course_ids: newDishCourseIds,
          description: newDishDescription.trim() || undefined,
          notes: newDishNotes.trim() || undefined,
          status_id: statusId,
          tags: newDishTags.map((t) => ({ name: t.name, color: t.color })),
        })
        const assignedIds =
          assignForSpecificMembers && selectedMemberIdsForDish.length > 0 ? selectedMemberIdsForDish : undefined
        onAssignDish(selectedSlotForDish, created.id, assignedIds)
      }
      setSelectedSlotForDish(null)
      setIsCreatingDish(false)
    } catch (err: any) {
      setCreateDishError(err.message || 'Errore nella creazione del piatto')
    } finally {
      setIsSavingDish(false)
    }
  }

  // P009: Check if meal type has any dishes assigned across the current week
  const hasDishesInWeek = (mealTypeId: number) => {
    return slots.some((s) => s.meal_type.id === mealTypeId && s.dishes.length > 0)
  }

  const handleDeleteMealType = async (mealTypeId: number, mealTypeName: string) => {
    if (window.confirm(t('calendar.remove_meal_type_confirm', { name: mealTypeName }))) {
      if (onDeleteMealTypeSlots) {
        await onDeleteMealTypeSlots(mealTypeId)
      }
    }
  }

  const handleSaveNote = (slotId: number, dishId: number) => {
    if (!noteText.trim()) return
    onAddSlotDishNote(slotId, dishId, noteText.trim())
    setNoteText('')
    setActiveNoteDishId(null)
  }

  // Group slots by date
  const slotsByDate: { [date: string]: MealSlot[] } = {}
  slots.forEach((s) => {
    if (!slotsByDate[s.date]) slotsByDate[s.date] = []
    slotsByDate[s.date].push(s)
  })

  const sortedDates = Object.keys(slotsByDate).sort()

  // 7 consecutive dates of the week
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = parseDate(startDate)
    d.setDate(d.getDate() + i)
    return formatDate(d)
  })

  // Unique meal types active or present in this week (P009)
  const activeMealTypes = mealTypes
    .filter((mt) => slots.some((s) => s.meal_type.id === mt.id))
    .sort((a, b) => a.default_sort_order - b.default_sort_order)

  // Unique available tags across all dishes for calendar dish picker
  const calendarAvailableTags = React.useMemo(() => {
    const map = new Map<string, { id?: number; name: string; color: string }>()
    dishes.forEach((d) => {
      d.tags?.forEach((t) => {
        if (!map.has(t.name.toLowerCase())) {
          map.set(t.name.toLowerCase(), t)
        }
      })
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [dishes])

  // P007 / Issue #7: Filtered dishes list by search text, course filter, and tags (AND logic)
  // Ensures dish search term is always trimmed of leading and trailing spaces before filtering
  const filteredDishes = useMemo(() => {
    const term = dishSearch.trim().toLowerCase()
    return dishes.filter((dish) => {
      const matchesSearch =
        !term ||
        dish.title.toLowerCase().includes(term) ||
        (dish.description && dish.description.toLowerCase().includes(term)) ||
        (dish.notes && dish.notes.toLowerCase().includes(term)) ||
        (dish.tags && dish.tags.some((t) => t.name.toLowerCase().includes(term)))

      const matchesCourse =
        selectedCourseFilter === null ||
        dish.courses.some((c) => c.id === selectedCourseFilter)

      const matchesTags =
        selectedCalendarTagFilters.length === 0 ||
        selectedCalendarTagFilters.every((tagName) =>
          dish.tags?.some((t) => t.name.toLowerCase() === tagName.toLowerCase())
        )

      return matchesSearch && matchesCourse && matchesTags
    })
  }, [dishes, dishSearch, selectedCourseFilter, selectedCalendarTagFilters])

  // Map of slot by date and meal_type_id
  const slotMap = new Map<string, MealSlot>()
  slots.forEach((s) => {
    slotMap.set(`${s.date}_${s.meal_type.id}`, s)
  })

  const currentTodayStr = formatDate(new Date())
  const isCurrentWeek = weekDates.includes(currentTodayStr)

  // Reusable slot body for both desktop matrix table and mobile single-column sequence
  const renderCompactSlotBody = (slot: MealSlot) => {
    const attSummary = getAttendanceSummary(slot.absent_member_ids)

    return (
      <div className="space-y-1 print:space-y-0.5 flex flex-col justify-start">
        {/* P010: Meal Slot Note */}
        {editingSlotNoteId === slot.id ? (
          <div className="flex items-center space-x-1 p-0.5 bg-amber-50 rounded border border-amber-300 mb-1 print:hidden">
            <input
              type="text"
              autoFocus
              value={editSlotNoteValue}
              onChange={(e) => setEditSlotNoteValue(e.target.value)}
              placeholder={t('calendar.slot_notes_placeholder')}
              className="w-full min-w-0 px-1 py-0.2 text-[9px] rounded border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSaveSlotNote(slot.id)
                } else if (e.key === 'Escape') {
                  setEditingSlotNoteId(null)
                }
              }}
            />
            <button
              type="button"
              onClick={() => handleSaveSlotNote(slot.id)}
              className="px-1 py-0.2 bg-amber-600 text-white font-medium text-[9px] rounded hover:bg-amber-700 flex-shrink-0"
            >
              ✓
            </button>
            <button
              type="button"
              onClick={() => setEditingSlotNoteId(null)}
              className="px-0.5 py-0.2 text-slate-500 hover:bg-amber-100 text-[9px] rounded flex-shrink-0"
            >
              ✕
            </button>
          </div>
        ) : slot.notes ? (
          <div
            className="group relative flex items-center justify-between text-[10px] print-meta-text py-0.5 px-1 print:py-1 print:px-1.5 rounded bg-amber-50/90 border border-amber-200/80 text-amber-900 shadow-2xs hover:bg-amber-100/70 transition-colors cursor-pointer mb-1 print:mb-1 print:shadow-none print:border-amber-200"
            onClick={() => handleStartEditSlotNote(slot.id, slot.notes)}
            title={t('calendar.edit_note_tooltip')}
          >
            <div className="truncate pr-1 text-[10px] print-meta-text leading-snug flex items-center space-x-1.5">
              <StickyNote className="w-2.5 h-2.5 print:w-3.5 print:h-3.5 flex-shrink-0 text-amber-700" />
              <span className="italic font-medium">{slot.notes}</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteSlotNote(slot.id)
              }}
              title={t('calendar.delete_note_title')}
              className="opacity-0 group-hover:opacity-100 text-amber-700 hover:text-rose-600 text-[9px] px-0.5 flex-shrink-0 transition-opacity print:hidden"
            >
              ✕
            </button>
          </div>
        ) : null}

        {slot.dishes.length === 0 ? (
          <>
            <button
              onClick={() => handleOpenAssignModal(slot.id)}
              className="w-full text-center py-1 sm:py-1 text-[10px] text-slate-400 hover:text-brand-600 hover:bg-slate-100/70 rounded border border-dashed border-slate-200 transition-colors flex items-center justify-center space-x-0.5 cursor-pointer print:hidden"
              title={t('calendar.add_dish_tooltip')}
            >
              <Plus className="w-2.5 h-2.5" />
              <span>{t('calendar.btn_dish')}</span>
            </button>
            <span className="hidden print:inline-block text-xs print-meta-text text-slate-300 italic pl-0.5">-</span>
          </>
        ) : (
          slot.dishes.map((d) => {
            const hasAssignedMembers =
              d.assigned_member_ids && d.assigned_member_ids.length > 0
            const assignedList = hasAssignedMembers
              ? members.filter((m) => d.assigned_member_ids?.includes(m.id))
              : []
            const namesStr = assignedList.map((m) => m.name).join(', ')

            return (
              <div
                key={d.id}
                className="group relative flex items-center justify-between text-xs py-0.5 px-1 print:py-0.5 print:px-1 rounded hover:bg-slate-100/80 transition-colors"
              >
                <div className="truncate pr-1 text-[11px] leading-snug flex-1 min-w-0 flex items-center">
                  <span
                    onClick={() => handleOpenDishDetail(d.dish_id)}
                    title={t('calendar.view_edit_dish_tooltip')}
                    className="font-medium text-slate-800 hover:text-brand-600 hover:underline cursor-pointer truncate inline-block print:pointer-events-none print:no-underline print:text-slate-900 print-dish-title"
                  >
                    • {d.dish_title}
                  </span>
                  {hasAssignedMembers && (
                    <span
                      onClick={() => handleOpenEditSlotDishModal(slot, d)}
                      title={t('calendar.edit_dish_assignment_tooltip')}
                      className="ml-1 text-[10px] text-amber-700 hover:text-amber-800 font-semibold whitespace-nowrap cursor-pointer hover:underline print:pointer-events-none print:no-underline print:italic print-meta-text"
                    >
                      ({namesStr})
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-0.5 flex-shrink-0 print:hidden">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenEditSlotDishModal(slot, d)
                    }}
                    title={t('calendar.edit_dish_assignment_tooltip')}
                    className="p-0.5 text-slate-400 hover:text-brand-600 hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
                  >
                    <Users className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenDishDetail(d.dish_id)
                    }}
                    title={t('calendar.view_edit_dish_tooltip')}
                    className="p-0.5 text-slate-400 hover:text-brand-600 hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveDish(slot.id, d.dish_id)
                    }}
                    title={t('calendar.remove_dish_tooltip')}
                    className="p-0.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          })
        )}

        {/* Bottom row of cell: Attendance on lower-left, actions on right */}
        <div className="flex items-center justify-between gap-1 pt-0.5 print:pt-1 min-w-0">
          <button
            type="button"
            onClick={() => handleOpenAttendanceModal(slot)}
            className="flex items-center space-x-1 text-slate-500 hover:text-brand-700 hover:bg-slate-100/80 px-1 py-0.5 rounded transition-colors min-w-0 max-w-[62%] truncate group text-left cursor-pointer print:pointer-events-none print:p-0 print:border-none print:bg-transparent print:max-w-none"
            title={attSummary.fullTooltip || t('calendar.manage_attendance_tooltip')}
          >
            <Users className="w-3 h-3 flex-shrink-0 text-slate-500 group-hover:text-brand-600 print:text-slate-600 print:w-3.5 print:h-3.5" />
            {attSummary.text ? (
              <span className="truncate text-[9px] print-meta-text font-medium text-slate-600 group-hover:text-brand-700 print:text-slate-700">
                {attSummary.text}
              </span>
            ) : null}
          </button>

          <div className="flex items-center space-x-0.5 flex-shrink-0 print:hidden">
            {slot.dishes.length > 0 && (
              <button
                onClick={() => handleOpenAssignModal(slot.id)}
                className="text-center py-0.5 px-1 text-[9px] text-slate-500 sm:text-slate-400 hover:text-brand-600 hover:bg-slate-100/50 rounded transition-colors flex items-center space-x-0.5 cursor-pointer"
                title={t('calendar.add_another_dish_tooltip')}
              >
                <Plus className="w-2.5 h-2.5" />
                <span>{t('calendar.btn_another_dish')}</span>
              </button>
            )}
            {!slot.notes && (
              <button
                onClick={() => handleStartEditSlotNote(slot.id, '')}
                className="px-1 text-center py-0.5 text-[9px] text-slate-500 sm:text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors flex items-center space-x-0.5 cursor-pointer"
                title={t('calendar.add_note_tooltip')}
              >
                <Plus className="w-2.5 h-2.5" />
                <span>{t('calendar.btn_note')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-2.5 pb-6 md:pb-4 print:space-y-0 print:p-0 print:m-0 print:overflow-hidden print:flex print:flex-col print:justify-start print-page-box print-scale-${printFontSize}`}>
      {/* Top Header & Navigation (G002 / Issue #13: mobile compact) */}
      <div className="bg-white rounded-lg px-3 py-1.5 border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-2 shadow-2xs print:hidden">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-1.5">
            <CalendarIcon className="w-4 h-4 text-brand-600" />
            <span>{t('calendar.title')}</span>
          </h2>
          <p className="text-[11px] text-slate-500">
            {t('calendar.subtitle')}
          </p>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-2 self-start md:self-auto flex-wrap gap-y-1.5">
          {/* P004 / Issue #13: Switch 3 modalità (Orizzontale, Verticale, Dettagliata) - icone su mobile, testo da sm: */}
          <div className="flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs">
            <button
              onClick={() => handleToggleViewMode('compact_h')}
              className={`flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                viewMode === 'compact_h'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title={t('calendar.view_horizontal')}
            >
              <LayoutGrid className="w-3 h-3" />
              <span className="hidden sm:inline">{t('calendar.view_horizontal')}</span>
            </button>
            <button
              onClick={() => handleToggleViewMode('compact_v')}
              className={`flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                viewMode === 'compact_v'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title={t('calendar.view_vertical')}
            >
              <Rows3 className="w-3 h-3" />
              <span className="hidden sm:inline">{t('calendar.view_vertical')}</span>
            </button>
            <button
              onClick={() => handleToggleViewMode('detailed')}
              className={`flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                viewMode === 'detailed'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title={t('calendar.view_detailed')}
            >
              <List className="w-3 h-3" />
              <span className="hidden sm:inline">{t('calendar.view_detailed')}</span>
            </button>
          </div>

          {/* Issue #22: Pulsante Stampa / Esporta PDF */}
          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-brand-600 transition-colors shadow-2xs cursor-pointer"
            title={t('calendar.print_menu_title')}
          >
            <Printer className="w-3.5 h-3.5 text-brand-600" />
            <span className="hidden xs:inline">{t('calendar.print_btn')}</span>
          </button>

          {/* P005: Scelta giorno inizio settimana */}
          <div className="flex items-center space-x-1 text-[11px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
            <span className="text-slate-400 font-medium hidden xs:inline">{t('calendar.start_day_from')}</span>
            <select
              value={weekStartDay}
              onChange={(e) => onChangeWeekStartDay(Number(e.target.value))}
              className="bg-transparent text-slate-700 font-medium focus:outline-hidden cursor-pointer text-[11px]"
              title={t('calendar.start_day_title')}
            >
              <option value={6}>{t('calendar.day_saturday')}</option>
              <option value={0}>{t('calendar.day_sunday')}</option>
              <option value={1}>{t('calendar.day_monday')}</option>
              <option value={2}>{t('calendar.day_tuesday')}</option>
              <option value={3}>{t('calendar.day_wednesday')}</option>
              <option value={4}>{t('calendar.day_thursday')}</option>
              <option value={5}>{t('calendar.day_friday')}</option>
              <option value={-1}>{t('calendar.day_today_rolling')}</option>
            </select>
          </div>

          {/* Navigazione Settimana con Quick Reset Oggi */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleShiftDays('prev')}
              className="p-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              title={t('calendar.prev_week')}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onResetToCurrentWeek}
              className={`px-1.5 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                isCurrentWeek
                  ? 'bg-slate-100 border-slate-200 text-slate-600'
                  : 'bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100 font-semibold'
              }`}
              title={t('calendar.btn_current_week')}
            >
              {t('calendar.today_badge')}
            </button>

            <span className="text-[10px] sm:text-[11px] font-semibold px-1.5 sm:px-2 py-0.5 bg-slate-100 rounded text-slate-700 whitespace-nowrap">
              {startDate} ➔ {endDate}
            </span>

            <button
              onClick={() => handleShiftDays('next')}
              className="p-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              title={t('calendar.next_week')}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic @page print CSS rules & A4 Physical Canvas Height & Typography Scaling */}
      <style>{`
        @media print {
          @page {
            size: A4 ${printLayout === 'fridge' || viewMode === 'compact_h' ? 'landscape' : 'portrait'};
            margin: 4mm;
          }
          .print-page-box {
            height: ${printLayout === 'fridge' || viewMode === 'compact_h' ? '198mm' : '285mm'} !important;
            max-height: ${printLayout === 'fridge' || viewMode === 'compact_h' ? '198mm' : '285mm'} !important;
          }

          /* Font size scaling modes */
          .print-scale-normal {
            --print-day-title-size: 15px;
            --print-meal-header-size: 13px;
            --print-dish-size: 14px;
            --print-meta-size: 12px;
            --print-badge-size: 10.5px;
          }
          .print-scale-large {
            --print-day-title-size: 18px;
            --print-meal-header-size: 15px;
            --print-dish-size: 16.5px;
            --print-meta-size: 13.5px;
            --print-badge-size: 12px;
          }
          .print-scale-xlarge {
            --print-day-title-size: 21px;
            --print-meal-header-size: 17.5px;
            --print-dish-size: 19px;
            --print-meta-size: 15px;
            --print-badge-size: 13.5px;
          }

          /* Semantic typography classes for print */
          .print-day-header {
            font-size: var(--print-day-title-size) !important;
            line-height: 1.2 !important;
            font-weight: 700 !important;
          }
          .print-meal-header {
            font-size: var(--print-meal-header-size) !important;
            line-height: 1.2 !important;
            font-weight: 700 !important;
          }
          .print-dish-title {
            font-size: var(--print-dish-size) !important;
            line-height: 1.25 !important;
            font-weight: 600 !important;
          }
          .print-meta-text {
            font-size: var(--print-meta-size) !important;
            line-height: 1.2 !important;
          }
          .print-badge-text {
            font-size: var(--print-badge-size) !important;
          }
        }
      `}</style>

      {/* Issue #22: Dedicated Clean Print Header */}
      <div className="hidden print:flex print:items-center print:justify-between print:mb-2 print:pb-1.5 border-b-2 border-brand-500 shrink-0">
        <div className="flex items-center space-x-2.5">
          <span className="text-xl leading-none">🍽️</span>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">
              {t('calendar.print_header_title')}
              {householdName ? ` • ${householdName}` : ''}
            </h1>
            <p className="text-xs text-slate-500 font-medium leading-none mt-0.5">
              {startDate} ➔ {endDate}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="inline-block text-xs font-bold uppercase px-2.5 py-0.5 rounded bg-brand-50 text-brand-800 border border-brand-200">
            {printLayout === 'fridge'
              ? t('calendar.print_layout_fridge')
              : viewMode === 'compact_h'
              ? t('calendar.view_horizontal')
              : viewMode === 'compact_v'
              ? t('calendar.view_vertical')
              : t('calendar.view_detailed')}
          </span>
        </div>
      </div>

      {/* Issue #22: Planner da Frigo (8-Box Landscape Layout for Print) */}
      <div className={printLayout === 'fridge' ? 'hidden print:block print:flex-1 print:min-h-0 print:overflow-hidden' : 'hidden'}>
        <div className="grid grid-cols-4 grid-rows-2 gap-2 h-full max-h-full">
          {weekDates.map((dateStr) => {
            const dateObj = parseDate(dateStr)
            const dayName = new Intl.DateTimeFormat(currentLocale, { weekday: 'long' }).format(dateObj)
            const dayNum = dateObj.getDate()
            const monthShort = new Intl.DateTimeFormat(currentLocale, { month: 'short' }).format(dateObj)
            const daySlots = activeMealTypes.map((mt) => ({
              mealType: mt,
              slot: slotMap.get(`${dateStr}_${mt.id}`),
            }))

            return (
              <div
                key={dateStr}
                className="border-2 border-slate-300 rounded-lg p-2.5 bg-white flex flex-col justify-start print-avoid-break overflow-hidden shadow-none"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-2">
                    <span className="font-bold text-slate-900 uppercase tracking-wide print-day-header">
                      {dayName}
                    </span>
                    <span className="font-bold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200 print-badge-text">
                      {dayNum} {monthShort}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {daySlots.map(({ mealType, slot }) => {
                      if (!slot) return null
                      const attSummary = getAttendanceSummary(slot.absent_member_ids)
                      const dishesList = slot.dishes || []

                      return (
                        <div key={mealType.id} className="space-y-0.5">
                          <div className="font-bold uppercase text-slate-500 tracking-wider mb-0.5 print-meal-header">
                            {getLocalizedMealTypeName(mealType, t)}
                          </div>

                          {dishesList.length === 0 ? (
                            <div className="text-slate-300 italic pl-0.5 print-meta-text">-</div>
                          ) : (
                            <div className="space-y-0.5 pl-0.5">
                              {dishesList.map((d) => {
                                const hasAssigned = d.assigned_member_ids && d.assigned_member_ids.length > 0
                                const assignedList = hasAssigned
                                  ? members.filter((m) => d.assigned_member_ids?.includes(m.id))
                                  : []
                                const namesStr = assignedList.map((m) => m.name).join(', ')

                                return (
                                  <div key={d.id} className="text-slate-900 leading-snug">
                                    <span className="font-semibold print-dish-title">• {d.dish_title}</span>
                                    {hasAssigned && (
                                      <span className="italic ml-1 font-medium text-amber-800 print-meta-text">
                                        ({namesStr})
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {!attSummary.isAllPresent && attSummary.text && (
                            <div className="text-slate-600 pl-0.5 flex items-center space-x-1 mt-0.5 print-meta-text">
                              <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="font-medium">{attSummary.text}</span>
                            </div>
                          )}

                          {slot.notes && (
                            <div className="text-amber-900 italic bg-amber-50/80 border border-amber-200/70 rounded px-1.5 py-0.5 mt-0.5 print-meta-text">
                              📝 {slot.notes}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Box 8: Note della Settimana / Promemoria da frigo */}
          <div className="border-2 border-slate-300 rounded-lg p-2.5 bg-white flex flex-col justify-start print-avoid-break overflow-hidden shadow-none">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-2">
                <span className="font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-1.5 print-day-header">
                  <StickyNote className="w-4 h-4 text-amber-600" />
                  <span>{t('calendar.print_week_notes_title')}</span>
                </span>
              </div>
              <div className="space-y-4 pt-2">
                <div className="border-b border-dashed border-slate-300 h-6"></div>
                <div className="border-b border-dashed border-slate-300 h-6"></div>
                <div className="border-b border-dashed border-slate-300 h-6"></div>
                <div className="border-b border-dashed border-slate-300 h-6"></div>
                <div className="border-b border-dashed border-slate-300 h-6"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'compact_h' ? (
        /* P003: Compact Horizontal Matrix View (7 days horizontally as columns, meal types as rows) */
        <div className={`bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs ${printLayout === 'fridge' ? 'print:hidden' : ''} print:shadow-none print:border-slate-300 print:flex-1 print:min-h-0 print:flex print:flex-col print:overflow-hidden`}>
          <div className="overflow-x-auto print:overflow-visible print:h-full print:flex print:flex-col">
            <table className="w-full text-left border-collapse table-fixed min-w-[760px] print:min-w-0 print:h-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-20 sm:w-24 px-2 py-1.5 print:py-2.5 print:px-2 font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200 text-center print-meal-header">
                    {t('calendar.meal_column')}
                  </th>
                  {weekDates.map((dateStr) => {
                    const dateObj = parseDate(dateStr)
                    const isToday = currentTodayStr === dateStr
                    const dayShort = new Intl.DateTimeFormat(currentLocale, { weekday: 'short' }).format(dateObj)
                    const dayNum = dateObj.getDate()
                    const monthShort = new Intl.DateTimeFormat(currentLocale, { month: 'short' }).format(dateObj)
                    return (
                      <th
                        key={dateStr}
                        className={`px-1.5 py-1 print:py-2.5 print:px-1.5 text-center border-r border-slate-200 last:border-r-0 ${
                          isToday ? 'bg-brand-50/80 text-brand-900 font-bold' : 'text-slate-700 font-semibold'
                        }`}
                      >
                        <div className="capitalize text-xs font-bold leading-tight print-day-header">{dayShort}</div>
                        <div className="text-[10px] text-slate-500 font-normal print-meta-text">
                          {dayNum} {monthShort}
                          {isToday && <span className="ml-1 text-[9px] text-brand-600 font-bold print-badge-text">• Oggi</span>}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {activeMealTypes.map((mt) => (
                  <tr key={mt.id} className="hover:bg-slate-50/40 transition-colors">
                    {/* Meal Type Row Header (P009) */}
                    <td className="px-2 py-2 print:py-2.5 print:px-2 font-bold text-[11px] text-slate-700 uppercase bg-slate-50/60 border-r border-slate-200 align-top print-meal-header">
                      <div className="flex items-center justify-between group">
                        <span className="truncate flex-1 text-center">{getLocalizedMealTypeName(mt, t)}</span>
                        {!hasDishesInWeek(mt.id) && onDeleteMealTypeSlots && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMealType(mt.id, getLocalizedMealTypeName(mt, t))}
                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-0.5 rounded transition-colors ml-1 print:hidden"
                            title={t('calendar.remove_meal_type_title', { name: getLocalizedMealTypeName(mt, t) })}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* 7 Day Cells */}
                    {weekDates.map((dateStr) => {
                      const slot = slotMap.get(`${dateStr}_${mt.id}`)
                      const isToday = currentTodayStr === dateStr

                      return (
                        <td
                          key={dateStr}
                          className={`px-1.5 py-1.5 print:py-2 print:px-2 border-r border-slate-200 last:border-r-0 align-top transition-colors ${
                            isToday ? 'bg-brand-50/25' : ''
                          }`}
                        >
                          {slot ? (
                            renderCompactSlotBody(slot)
                          ) : (
                            <button
                              onClick={() => onAddCustomSlot(dateStr, mt.id)}
                              className="w-full h-full min-h-[32px] flex items-center justify-center text-[10px] text-slate-300 hover:text-brand-600 hover:bg-slate-50 rounded transition-colors print:hidden"
                              title={t('calendar.add_slot_for_day', { name: getLocalizedMealTypeName(mt, t) })}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode === 'compact_v' ? (
        /* P004 / Issue #13: Compact Vertical View (Desktop Matrix + Mobile Single-Column Sequence) */
        <div className={`space-y-2 ${printLayout === 'fridge' ? 'print:hidden' : ''} print:space-y-0 print:flex-1 print:min-h-0 print:flex print:flex-col print:overflow-hidden`}>
          {/* Desktop Table View (>= md): Days as rows, meal types as columns */}
          <div className="hidden md:block print:block bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs print:shadow-none print:border-slate-300 print:h-full print:flex print:flex-col">
            <div className="overflow-x-auto print:overflow-visible print:h-full print:flex print:flex-col">
              <table className="w-full text-left border-collapse min-w-[760px] print:min-w-0 print:h-full print:table-fixed">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="w-28 sm:w-36 print:w-28 px-2 py-1.5 print:py-2.5 print:px-2 font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200 text-center print-meal-header">
                      {t('calendar.day_col')}
                    </th>
                    {activeMealTypes.map((mt) => (
                      <th
                        key={mt.id}
                        className="px-2 py-1 print:py-2.5 print:px-2 text-center font-bold text-slate-700 uppercase border-r border-slate-200 last:border-r-0 print-meal-header"
                      >
                        <div className="flex items-center justify-center space-x-1">
                          <span className="truncate">{getLocalizedMealTypeName(mt, t)}</span>
                          {!hasDishesInWeek(mt.id) && onDeleteMealTypeSlots && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMealType(mt.id, getLocalizedMealTypeName(mt, t))}
                              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-0.5 rounded transition-colors cursor-pointer print:hidden"
                              title={t('calendar.remove_meal_type_title', { name: getLocalizedMealTypeName(mt, t) })}
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {weekDates.map((dateStr) => {
                    const dateObj = parseDate(dateStr)
                    const isToday = currentTodayStr === dateStr
                    const dayShort = new Intl.DateTimeFormat(currentLocale, { weekday: 'short' }).format(dateObj)
                    const dayNum = dateObj.getDate()
                    const monthShort = new Intl.DateTimeFormat(currentLocale, { month: 'short' }).format(dateObj)

                    return (
                      <tr
                        key={dateStr}
                        className={`hover:bg-slate-50/40 transition-colors print:h-[calc(100%/8)] ${isToday ? 'bg-brand-50/25' : ''}`}
                      >
                        {/* Day Header Cell (Row Header) */}
                        <td
                          valign="top"
                          className={`px-2 py-2 print:py-2 print:px-2 border-r border-slate-200 align-top print:align-top ${
                            isToday ? 'bg-brand-50/70 text-brand-900' : 'bg-slate-50/60 text-slate-800'
                          }`}
                        >
                          <div className="flex flex-col items-center justify-start text-center">
                            <span className="capitalize font-bold text-xs print-day-header">{dayShort}</span>
                            <span className="text-[11px] text-slate-600 font-medium print-meta-text">
                              {dayNum} {monthShort}
                            </span>
                            {isToday && (
                              <span className="mt-0.5 bg-brand-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase print-badge-text">
                                {t('calendar.today_badge')}
                              </span>
                            )}
                            <button
                              onClick={() => setSelectedMealTypeForDate(dateStr)}
                              className="mt-1.5 flex items-center space-x-0.5 text-[9px] text-slate-500 hover:text-brand-600 border border-slate-200 bg-white hover:bg-slate-50 px-1.5 py-0.5 rounded transition-colors cursor-pointer print:hidden"
                              title={`+ ${t('calendar.btn_meal')} (${dayShort} ${dayNum})`}
                            >
                              <Plus className="w-2.5 h-2.5" />
                              <span>{t('calendar.btn_meal')}</span>
                            </button>
                          </div>
                        </td>

                        {/* Meal Type Cells for this Day */}
                        {activeMealTypes.map((mt) => {
                          const slot = slotMap.get(`${dateStr}_${mt.id}`)
                          return (
                            <td
                              key={mt.id}
                              valign="top"
                              className="px-2 py-1.5 print:py-2 print:px-2.5 border-r border-slate-200 last:border-r-0 align-top print:align-top min-w-[140px] print:min-w-0"
                            >
                              {slot ? (
                                renderCompactSlotBody(slot)
                              ) : (
                                <button
                                  onClick={() => onAddCustomSlot(dateStr, mt.id)}
                                  className="w-full h-full min-h-[32px] flex items-center justify-center text-[10px] text-slate-300 hover:text-brand-600 hover:bg-slate-50 rounded transition-colors cursor-pointer print:hidden"
                                  title={t('calendar.add_slot_for_day', { name: getLocalizedMealTypeName(mt, t) })}
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Single-Column Sequence (< md): zero horizontal scroll! */}
          <div className="block md:hidden print:hidden space-y-2">
            {weekDates.map((dateStr) => {
              const dateObj = parseDate(dateStr)
              const isToday = currentTodayStr === dateStr
              const dayShort = new Intl.DateTimeFormat(currentLocale, { weekday: 'short' }).format(dateObj)
              const dayNum = dateObj.getDate()
              const monthShort = new Intl.DateTimeFormat(currentLocale, { month: 'short' }).format(dateObj)

              return (
                <div
                  key={dateStr}
                  className={`bg-white rounded-lg border transition-all overflow-hidden ${
                    isToday ? 'border-brand-400 shadow-xs' : 'border-slate-200'
                  }`}
                >
                  {/* Day Header Bar */}
                  <div
                    className={`px-3 py-1.5 flex items-center justify-between border-b ${
                      isToday
                        ? 'bg-brand-50/80 border-brand-200 text-brand-900'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <span className="capitalize font-bold text-xs">{dayShort}</span>
                      <span className="text-xs font-semibold text-slate-700">
                        {dayNum} {monthShort}
                      </span>
                      {isToday && (
                        <span className="bg-brand-600 text-white text-[8px] font-bold px-1.5 py-0.2 rounded uppercase">
                          {t('calendar.today_badge')}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedMealTypeForDate(dateStr)}
                      className="flex items-center space-x-1 text-[10px] font-medium text-slate-600 hover:text-brand-600 bg-white border border-slate-200 px-2 py-0.5 rounded transition-colors cursor-pointer"
                      title={`+ ${t('calendar.btn_meal')}`}
                    >
                      <Plus className="w-3 h-3 text-brand-600" />
                      <span>{t('calendar.btn_meal')}</span>
                    </button>
                  </div>

                  {/* Meals Sequence for this day (single column) */}
                  <div className="divide-y divide-slate-100">
                    {activeMealTypes.map((mt) => {
                      const slot = slotMap.get(`${dateStr}_${mt.id}`)
                      const localizedMt = getLocalizedMealTypeName(mt, t)

                      return (
                        <div key={mt.id} className="p-2 sm:p-2.5 space-y-1.5">
                          {/* Meal Type Title Badge & Delete (if unused) */}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                              {localizedMt}
                            </span>
                            {!hasDishesInWeek(mt.id) && onDeleteMealTypeSlots && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMealType(mt.id, localizedMt)}
                                className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                                title={t('calendar.remove_meal_type_title', { name: localizedMt })}
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>

                          {/* Slot Content or Add Slot Button */}
                          {slot ? (
                            renderCompactSlotBody(slot)
                          ) : (
                            <button
                              type="button"
                              onClick={() => onAddCustomSlot(dateStr, mt.id)}
                              className="w-full text-center py-1.5 text-[10px] text-slate-400 hover:text-brand-600 hover:bg-slate-50 rounded border border-dashed border-slate-200 transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                              title={t('calendar.add_slot_for_day', { name: localizedMt })}
                            >
                              <Plus className="w-2.5 h-2.5" />
                              <span>{t('calendar.add_slot_for_day', { name: localizedMt })}</span>
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* Detailed Days List */
        <div className={`space-y-2 ${printLayout === 'fridge' ? 'print:hidden' : ''} print:space-y-0 print:flex-1 print:min-h-0 print:grid print:grid-cols-2 print:gap-1.5 print:overflow-hidden`}>
        {sortedDates.map((dateStr) => {
          const daySlots = slotsByDate[dateStr]
          const dateObj = new Date(dateStr)
          const isToday = new Date().toISOString().split('T')[0] === dateStr
          const dayTitle = new Intl.DateTimeFormat(currentLocale, {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
          }).format(dateObj)

          return (
            <div
              key={dateStr}
              className={`bg-white rounded-lg border ${
                isToday ? 'border-brand-400 shadow-2xs' : 'border-slate-200'
              } overflow-hidden print-avoid-break print:shadow-none print:border-slate-300 print:p-2.5 print:h-full print:flex print:flex-col justify-start print:justify-start`}
            >
              {/* Day Header (compact) */}
              <div
                className={`px-3 py-1 print:px-2.5 print:py-1.5 flex items-center justify-between border-b ${
                  isToday
                    ? 'bg-brand-50 border-brand-200 text-brand-900'
                    : 'bg-slate-50/80 border-slate-200/80 text-slate-800'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="font-bold capitalize text-xs sm:text-sm print-day-header">{dayTitle}</span>
                  {isToday && (
                    <span className="bg-brand-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase print-badge-text">
                      {t('calendar.today_badge')}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setSelectedMealTypeForDate(dateStr)}
                  className="flex items-center space-x-1 text-[10px] font-medium text-slate-600 hover:text-brand-600 bg-white border border-slate-200 px-2 py-0.5 rounded transition-colors print:hidden"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>{t('calendar.add_meal_slot')}</span>
                </button>
              </div>

              {/* Day's Meal Slots */}
              <div className="p-2 print:p-1.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 gap-2 print:gap-2 content-start print:content-start">
                {daySlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="rounded-md border border-slate-200 bg-white p-2 print:p-2 flex flex-col justify-between print:justify-start space-y-1.5 print:space-y-1.5 shadow-2xs print:shadow-none print:border-slate-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-[10px] uppercase px-1.5 py-0.2 print:px-2 print:py-0.5 rounded-full bg-slate-100 text-slate-700 print-meal-header">
                          {getLocalizedMealTypeName(slot.meal_type, t)}
                        </span>
                        {(() => {
                          const attSummary = getAttendanceSummary(slot.absent_member_ids)
                          return (
                            <button
                              type="button"
                              onClick={() => handleOpenAttendanceModal(slot)}
                              className="flex items-center space-x-1 text-[10px] text-slate-500 hover:text-brand-700 bg-slate-100/80 hover:bg-brand-50 border border-slate-200/80 px-1.5 py-0.5 rounded-full transition-colors group cursor-pointer print:pointer-events-none print:bg-transparent print:border-none print:p-0"
                              title={attSummary.fullTooltip || t('calendar.manage_attendance_tooltip')}
                            >
                              <Users className="w-3 h-3 text-slate-500 group-hover:text-brand-600 print:text-slate-600" />
                              {attSummary.text && (
                                <span className="font-semibold text-[10px] text-slate-600 group-hover:text-brand-700 print:text-slate-700 print-meta-text">
                                  {attSummary.text}
                                </span>
                              )}
                            </button>
                          )
                        })()}
                      </div>

                      <button
                        onClick={() => onDeleteSlot(slot.id)}
                        title={t('common.delete')}
                        className="text-slate-300 hover:text-rose-500 p-0.5 rounded transition-colors print:hidden"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* P010: Meal Slot General Note */}
                    {editingSlotNoteId === slot.id ? (
                      <div className="flex items-center space-x-1 p-1 bg-amber-50/90 rounded border border-amber-300 mb-1 print:hidden">
                        <input
                          type="text"
                          autoFocus
                          value={editSlotNoteValue}
                          onChange={(e) => setEditSlotNoteValue(e.target.value)}
                          placeholder={t('calendar.slot_notes_placeholder_example')}
                          className="flex-1 px-1.5 py-0.5 text-xs rounded border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleSaveSlotNote(slot.id)
                            } else if (e.key === 'Escape') {
                              setEditingSlotNoteId(null)
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveSlotNote(slot.id)}
                          className="px-2 py-0.5 bg-amber-600 text-white font-medium text-xs rounded hover:bg-amber-700"
                        >
                          {t('common.save')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSlotNoteId(null)}
                          className="px-1 py-0.5 text-slate-500 hover:bg-amber-100 text-xs rounded"
                        >
                          ✕
                        </button>
                      </div>
                    ) : slot.notes ? (
                      <div
                        className="group relative flex items-start justify-between p-1.5 rounded bg-amber-50/80 border border-amber-200/90 text-amber-900 text-xs shadow-2xs hover:bg-amber-100/70 transition-colors cursor-pointer mb-1 print:shadow-none"
                        onClick={() => handleStartEditSlotNote(slot.id, slot.notes)}
                        title={t('calendar.edit_note_tooltip')}
                      >
                        <div className="flex items-start space-x-1.5 pr-2">
                          <StickyNote className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 mt-0.5" />
                          <span className="italic font-medium leading-snug break-words">{slot.notes}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteSlotNote(slot.id)
                          }}
                          title={t('calendar.delete_note_title')}
                          className="opacity-0 group-hover:opacity-100 text-amber-600 hover:text-rose-600 hover:bg-amber-200/50 p-0.5 rounded transition-opacity print:hidden"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : null}

                    {/* Dishes in this slot */}
                    <div className="space-y-1.5 flex-1">
                      {slot.dishes.length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic py-1">
                          {t('calendar.no_dishes_planned')}
                        </p>
                      ) : (
                        slot.dishes.map((d) => {
                          const hasAssignedMembers =
                            d.assigned_member_ids && d.assigned_member_ids.length > 0
                          const assignedMembersList = hasAssignedMembers
                            ? members.filter((m) => d.assigned_member_ids?.includes(m.id))
                            : []

                          const isAddingNote =
                            activeNoteDishId?.slotId === slot.id && activeNoteDishId?.dishId === d.dish_id

                          return (
                            <div
                              key={d.id}
                              className="p-1.5 rounded bg-slate-50 border border-slate-100 text-xs space-y-1"
                            >
                              <div className="flex items-start justify-between font-medium text-slate-800">
                                <div className="min-w-0 flex-1">
                                  <span
                                    onClick={() => handleOpenDishDetail(d.dish_id)}
                                    title={t('calendar.view_edit_dish_tooltip')}
                                    className="font-semibold text-xs text-slate-800 hover:text-brand-600 hover:underline cursor-pointer block truncate print:pointer-events-none print:no-underline print-dish-title"
                                  >
                                    {d.dish_title}
                                  </span>
                                  {/* P002: Badge for alternative dish */}
                                  {hasAssignedMembers && (
                                    <span
                                      onClick={() => handleOpenEditSlotDishModal(slot, d)}
                                      title={t('calendar.edit_dish_assignment_tooltip')}
                                      className="text-[9px] text-amber-800 hover:text-amber-900 font-medium bg-amber-50 hover:bg-amber-100 border border-amber-200 px-1 py-0.2 rounded mt-0.5 inline-block cursor-pointer transition-colors print:pointer-events-none print:no-underline print-meta-text"
                                    >
                                      {t('calendar.for_diners', { names: assignedMembersList.map((m) => m.name).join(', ') })}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center space-x-1 flex-shrink-0 print:hidden ml-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleOpenEditSlotDishModal(slot, d)
                                    }}
                                    title={t('calendar.edit_dish_assignment_tooltip')}
                                    className="p-1 text-slate-400 hover:text-brand-600 hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
                                  >
                                    <Users className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleOpenDishDetail(d.dish_id)
                                    }}
                                    title={t('calendar.view_edit_dish_tooltip')}
                                    className="p-1 text-slate-400 hover:text-brand-600 hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onRemoveDish(slot.id, d.dish_id)
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                    title={t('common.delete')}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Smart Compatibility Alert */}
                              {d.compatibility.status === 'warning' && (
                                <div className="flex items-center space-x-1 text-amber-800 font-medium bg-amber-50 p-1 rounded text-[10px]">
                                  <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0 text-amber-600" />
                                  <span>{getLocalizedCompatibilityMessage(d.compatibility, t)}</span>
                                </div>
                              )}

                              {d.compatibility.status === 'hit' && (
                                <div className="flex items-center space-x-1 text-pink-700 font-medium bg-pink-50 p-1 rounded text-[10px]">
                                  <Star className="w-2.5 h-2.5 flex-shrink-0 fill-pink-500" />
                                  <span>{getLocalizedCompatibilityMessage(d.compatibility, t)}</span>
                                </div>
                              )}

                              {d.compatibility.status === 'ok' && !d.compatibility.is_conflict && (
                                <div className="flex items-center space-x-1 text-emerald-600 text-[10px]">
                                  <CheckCircle className="w-2.5 h-2.5" />
                                  <span>{t('calendar.dish_liked')}</span>
                                </div>
                              )}

                              {/* J002 / J003: Valutazione facoltativa per questo pasto */}
                              <div className="pt-1 border-t border-slate-200/60 space-y-0.5 print:hidden">
                                <div className="flex items-center justify-between text-[9px] text-slate-400">
                                  <span className="font-semibold uppercase tracking-wider">
                                    {t('calendar.meal_rating_label')}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {members.map((m) => {
                                    const mealRatingObj = d.ratings?.find((r) => r.member_id === m.id)
                                    const currentMealRating = mealRatingObj?.rating
                                    const isThumbsUp = currentMealRating === 'thumbs_up'
                                    const isNeutral = currentMealRating === 'neutral'
                                    const isThumbsDown = currentMealRating === 'thumbs_down'

                                    const handleToggleRating = (targetRating: 'thumbs_up' | 'neutral' | 'thumbs_down') => {
                                      if (currentMealRating === targetRating) {
                                        onDeleteSlotDishRating(slot.id, d.dish_id, m.id)
                                      } else {
                                        onSetSlotDishRating(slot.id, d.dish_id, m.id, targetRating)
                                      }
                                    }

                                    return (
                                      <div
                                        key={m.id}
                                        className={`flex items-center space-x-1 px-1.5 py-0.2 rounded text-[10px] border transition-colors ${
                                          isThumbsDown
                                            ? 'bg-rose-50/70 border-rose-200 ring-1 ring-rose-100'
                                            : isThumbsUp
                                            ? 'bg-sky-50/70 border-sky-200 ring-1 ring-sky-100'
                                            : isNeutral
                                            ? 'bg-emerald-50/70 border-emerald-200 ring-1 ring-emerald-100'
                                            : 'bg-white border-slate-200/80'
                                        }`}
                                      >
                                        <span
                                          className="w-1.5 h-1.5 rounded-full"
                                          style={{ backgroundColor: m.avatar_color || '#3B82F6' }}
                                        />
                                        <span className="text-slate-700 font-medium">{m.name}:</span>

                                        <div className="flex items-center rounded border border-slate-200 overflow-hidden bg-slate-50">
                                          {/* Piace (👍 - Blu sfumato) */}
                                          <button
                                            type="button"
                                            onClick={() => handleToggleRating('thumbs_up')}
                                            title={`${m.name}: Piaciuto in questo pasto (tocca per deselezionare)`}
                                            className={`px-1 py-0.2 transition-all ${
                                              isThumbsUp ? 'bg-sky-500 text-white font-bold' : 'text-slate-300 hover:text-sky-600'
                                            }`}
                                          >
                                            <ThumbsUp className="w-2.5 h-2.5" />
                                          </button>
                                          {/* Neutro (😐 - Verde) */}
                                          <button
                                            type="button"
                                            onClick={() => handleToggleRating('neutral')}
                                            title={`${m.name}: Normale / Ok (tocca per deselezionare)`}
                                            className={`px-1 py-0.2 transition-all ${
                                              isNeutral ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300 hover:text-emerald-600'
                                            }`}
                                          >
                                            <Meh className="w-2.5 h-2.5" />
                                          </button>
                                          {/* Non piace (👎 - Rosso sfumato) */}
                                          <button
                                            type="button"
                                            onClick={() => handleToggleRating('thumbs_down')}
                                            title={`${m.name}: Non piaciuto in questo pasto (tocca per deselezionare)`}
                                            className={`px-1 py-0.2 transition-all ${
                                              isThumbsDown ? 'bg-rose-400 text-white font-bold' : 'text-slate-300 hover:text-rose-400'
                                            }`}
                                          >
                                            <ThumbsDown className="w-2.5 h-2.5" />
                                          </button>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>

                              {/* J001: Notes list and inline add */}
                              <div className="pt-1 border-t border-slate-200/60 space-y-0.5">
                                <div className="flex items-center justify-between text-[9px] text-slate-400">
                                  <span className="flex items-center space-x-1">
                                    <MessageSquare className="w-2.5 h-2.5" />
                                    <span>{t('calendar.notes_count', { count: d.notes_list?.length || 0 })}</span>
                                  </span>
                                  {!isAddingNote && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveNoteDishId({ slotId: slot.id, dishId: d.dish_id })
                                        setNoteText('')
                                      }}
                                      className="text-brand-600 hover:text-brand-700 font-medium print:hidden"
                                    >
                                      {t('calendar.add_note')}
                                    </button>
                                  )}
                                </div>

                                {d.notes_list && d.notes_list.length > 0 && (
                                  <div className="space-y-0.5">
                                    {d.notes_list.map((n) => (
                                      <div
                                        key={n.id}
                                        className="p-1 rounded bg-white border border-slate-200/70 flex items-start justify-between text-[10px]"
                                      >
                                        <p className="text-slate-700 whitespace-pre-wrap flex-1">{n.note}</p>
                                        <button
                                          type="button"
                                          onClick={() => onDeleteSlotDishNote(slot.id, d.dish_id, n.id)}
                                          className="text-slate-400 hover:text-rose-500 ml-1 p-0.5 print:hidden"
                                          title={t('calendar.delete_note_title')}
                                        >
                                          <X className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {isAddingNote && (
                                  <div className="flex items-center space-x-1 pt-0.5 print:hidden">
                                    <input
                                      type="text"
                                      autoFocus
                                      value={noteText}
                                      onChange={(e) => setNoteText(e.target.value)}
                                      placeholder={t('calendar.slot_notes_placeholder')}
                                      className="flex-1 px-1.5 py-0.5 text-[10px] rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault()
                                          handleSaveNote(slot.id, d.dish_id)
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveNote(slot.id, d.dish_id)}
                                      className="px-2 py-0.5 bg-brand-600 text-white font-medium text-[10px] rounded hover:bg-brand-700"
                                    >
                                      {t('common.save')}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setActiveNoteDishId(null)}
                                      className="px-1 py-0.5 text-slate-500 hover:bg-slate-100 text-[10px] rounded"
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

                    <div className="flex items-center space-x-1.5 print:hidden">
                      <button
                        onClick={() => handleOpenAssignModal(slot.id)}
                        className="flex-1 py-1 bg-slate-50 hover:bg-slate-100 text-brand-700 font-medium text-xs rounded border border-slate-200/80 transition-colors flex items-center justify-center space-x-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{t('calendar.choose_dish')}</span>
                      </button>
                      {!slot.notes && (
                        <button
                          onClick={() => handleStartEditSlotNote(slot.id, '')}
                          className="py-1 px-2.5 bg-slate-50 hover:bg-amber-50 text-amber-800 font-medium text-xs rounded border border-slate-200/80 hover:border-amber-300 transition-colors flex items-center justify-center space-x-1"
                          title={t('calendar.add_note_tooltip')}
                        >
                          <Plus className="w-3 h-3 text-amber-600" />
                          <span>{t('calendar.btn_note')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        </div>
      )}

      {/* Modal: Add Custom Slot to Date */}
      {selectedMealTypeForDate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-lg p-4 max-w-sm w-full space-y-3 shadow-xl">
            <h3 className="font-bold text-sm text-slate-900">{t('calendar.add_meal_type')}</h3>
            <p className="text-xs text-slate-500">
              {selectedMealTypeForDate}:
            </p>

            <select
              value={newSlotMealTypeId}
              onChange={(e) => setNewSlotMealTypeId(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs sm:text-sm bg-white"
            >
              {mealTypes.map((mt) => (
                <option key={mt.id} value={mt.id}>
                  {getLocalizedMealTypeName(mt, t)}
                </option>
              ))}
            </select>

            <div className="flex justify-end space-x-2 pt-1">
              <button
                onClick={() => setSelectedMealTypeForDate(null)}
                className="px-3 py-1 rounded text-xs text-slate-600 hover:bg-slate-100"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  onAddCustomSlot(selectedMealTypeForDate, newSlotMealTypeId)
                  setSelectedMealTypeForDate(null)
                }}
                className="px-3 py-1 rounded text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 shadow-2xs"
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Pick Dish for Slot (P002: Diners Selection, P007: Search/Filter, P008: Quick Create) */}
      {selectedSlotForDish !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3 sm:p-4">
          <div
            className={`bg-white rounded-lg p-4 max-w-lg w-full space-y-2.5 shadow-xl transition-all ${
              isCreatingDish ? 'h-auto max-h-[92vh] overflow-y-auto' : 'max-h-[88vh] flex flex-col'
            }`}
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
                <Utensils className="w-3.5 h-3.5 text-brand-600" />
                <span>{isCreatingDish ? t('calendar.new_dish_btn') : t('calendar.select_dish_placeholder')}</span>
              </h3>
              <div className="flex items-center space-x-1">
                {!isCreatingDish && onCreateDish && (
                  <button
                    type="button"
                    onClick={() => handleStartCreateDish()}
                    className="flex items-center space-x-1 text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-2 py-0.5 rounded transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t('calendar.new_dish_btn')}</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedSlotForDish(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs p-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* P002: Option to target specific diners (alternative dish) */}
            <div className="p-2 rounded bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 flex items-center space-x-1 text-[11px]">
                  <Users className="w-3 h-3 text-brand-600" />
                  <span>{t('calendar.alternative_dish')}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAssignForSpecificMembers(!assignForSpecificMembers)
                    if (!assignForSpecificMembers) {
                      setSelectedMemberIdsForDish(members.map((m) => m.id))
                    } else {
                      setSelectedMemberIdsForDish([])
                    }
                  }}
                  className="text-[10px] font-medium text-brand-600 hover:text-brand-700 underline"
                >
                  {assignForSpecificMembers ? t('common.all') : t('calendar.alternative_dish_help')}
                </button>
              </div>

              {assignForSpecificMembers ? (
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block">
                    {t('calendar.select_diners')}
                  </span>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {members.map((m) => {
                      const isSelected = selectedMemberIdsForDish.includes(m.id)
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => handleToggleMemberForDish(m.id)}
                          className={`flex items-center space-x-1 px-1.5 py-0.2 rounded-full text-[11px] transition-all border ${
                            isSelected
                              ? 'bg-brand-50 text-brand-800 border-brand-300 font-semibold'
                              : 'bg-white text-slate-500 border-slate-200'
                          }`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: m.avatar_color || '#3B82F6' }}
                          />
                          <span>{m.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 italic">
                  {t('calendar.alternative_dish_help')}
                </p>
              )}
            </div>

            {isCreatingDish ? (
              /* P008: Inline Quick Create Dish Form */
              <form onSubmit={handleQuickCreateDishSubmit} className="space-y-2.5">
                {createDishError && (
                  <div className="p-2 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded">
                    {createDishError}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {t('dishes.dish_title')} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newDishTitle}
                    onChange={(e) => setNewDishTitle(e.target.value)}
                    onBlur={() => setNewDishTitle((prev) => prev.trim())}
                    placeholder={t('dishes.dish_title_placeholder')}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-brand-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {t('dishes.dish_courses')}
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {courses.map((c) => {
                      const isSelected = newDishCourseIds.includes(c.id)
                      return (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => handleToggleCourseForNewDish(c.id)}
                          className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                            isSelected
                              ? 'bg-brand-600 text-white border-brand-600 font-semibold'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {getLocalizedCourseName(c.name, t)}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {t('dishes.dish_description')}
                  </label>
                  <textarea
                    rows={2}
                    value={newDishDescription}
                    onChange={(e) => setNewDishDescription(e.target.value)}
                    placeholder={t('dishes.dish_description_placeholder')}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-brand-500 focus:outline-hidden resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {t('dishes.dish_notes')}
                  </label>
                  <textarea
                    rows={2}
                    value={newDishNotes}
                    onChange={(e) => setNewDishNotes(e.target.value)}
                    placeholder={t('dishes.dish_notes_placeholder')}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-brand-500 focus:outline-hidden resize-none"
                  />
                </div>

                {/* Quick Create Tags Selector (Issue #7) */}
                <DishTagSelector
                  selectedTags={newDishTags}
                  availableTags={calendarAvailableTags}
                  onChange={setNewDishTags}
                />

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingDish(false)
                      setCreateDishError(null)
                    }}
                    className="px-3 py-1 rounded text-xs text-slate-600 hover:bg-slate-100"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingDish}
                    className="px-3 py-1 rounded text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-2xs flex items-center space-x-1"
                  >
                    {isSavingDish && <span className="animate-spin mr-1">⏳</span>}
                    <span>{t('calendar.assign')}</span>
                  </button>
                </div>
              </form>
            ) : (
              /* P007: Search, Course Filter, and Dish List */
              <>
                <div className="space-y-1.5">
                  {/* Search input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={dishSearch}
                      onChange={(e) => setDishSearch(e.target.value)}
                      onBlur={() => setDishSearch((prev) => prev.trim())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setDishSearch((prev) => prev.trim())
                      }}
                      placeholder={t('calendar.select_dish_placeholder')}
                      className="w-full pl-8 pr-7 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-brand-500 focus:outline-hidden"
                    />
                    {dishSearch && (
                      <button
                        type="button"
                        onClick={() => setDishSearch('')}
                        className="text-slate-400 hover:text-slate-600 absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Course type filter chips */}
                  {courses.length > 0 && (
                    <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setSelectedCourseFilter(null)}
                        className={`px-2 py-0.5 rounded-full whitespace-nowrap border transition-all ${
                          selectedCourseFilter === null
                            ? 'bg-brand-600 text-white border-brand-600 font-semibold'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {t('common.all')} ({dishes.length})
                      </button>
                      {courses.map((c) => {
                        const count = dishes.filter((d) => d.courses.some((dc) => dc.id === c.id)).length
                        const isSelected = selectedCourseFilter === c.id
                        return (
                          <button
                            type="button"
                            key={c.id}
                            onClick={() => setSelectedCourseFilter(isSelected ? null : c.id)}
                            className={`px-2 py-0.5 rounded-full whitespace-nowrap border transition-all ${
                              isSelected
                                ? 'bg-brand-600 text-white border-brand-600 font-semibold'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {getLocalizedCourseName(c.name, t)} ({count})
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Tag filter chips (AND logic) */}
                  {calendarAvailableTags.length > 0 && (
                    <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px] flex-wrap">
                      <span className="text-slate-400 font-medium px-1 text-[9px] flex items-center">
                        <TagIcon className="w-2.5 h-2.5 mr-0.5 text-brand-600" /> {t('tags.filter_by_tags', 'Tag (AND)')}:
                      </span>
                      {selectedCalendarTagFilters.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedCalendarTagFilters([])}
                          className="px-1.5 py-0.2 rounded-full whitespace-nowrap bg-slate-200 text-slate-700 hover:bg-slate-300 text-[9px] font-medium"
                        >
                          ✕ {t('common.clear', 'Azzera')}
                        </button>
                      )}
                      {calendarAvailableTags.map((tItem) => {
                        const isSelected = selectedCalendarTagFilters.some(
                          (st) => st.toLowerCase() === tItem.name.toLowerCase()
                        )
                        const tagColor = tItem.color || '#16a34a'
                        return (
                          <button
                            type="button"
                            key={tItem.name}
                            onClick={() =>
                              setSelectedCalendarTagFilters((prev) =>
                                prev.some((st) => st.toLowerCase() === tItem.name.toLowerCase())
                                  ? prev.filter((st) => st.toLowerCase() !== tItem.name.toLowerCase())
                                  : [...prev, tItem.name]
                              )
                            }
                            className={`px-2 py-0.5 rounded-full whitespace-nowrap border transition-all text-[9px] font-semibold flex items-center space-x-1 ${
                              isSelected
                                ? 'text-white shadow-2xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                            style={isSelected ? { backgroundColor: tagColor, borderColor: tagColor } : {}}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: isSelected ? '#ffffff' : tagColor }}
                            />
                            <span>{tItem.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Filtered Dishes List */}
                <div className="overflow-y-auto flex-1 space-y-1 pr-1">
                  {filteredDishes.length === 0 ? (
                    <div className="text-center py-6 px-4 space-y-2">
                      <p className="text-xs text-slate-500">
                        {dishSearch.trim()
                          ? t('calendar.no_dishes_for_query', { query: dishSearch.trim() })
                          : t('calendar.no_dishes_matched')}
                      </p>
                      {onCreateDish && (
                        <button
                          type="button"
                          onClick={() => handleStartCreateDish(dishSearch.trim())}
                          className="inline-flex items-center space-x-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-2.5 py-1 rounded transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>
                            {dishSearch.trim()
                              ? t('calendar.create_dish_as_new', { name: dishSearch.trim() })
                              : t('calendar.create_new_dish')}
                          </span>
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredDishes.map((dish) => (
                      <div
                        key={dish.id}
                        onClick={() => handleSelectDishForSlot(dish.id)}
                        className="p-2 rounded border border-slate-200 hover:border-brand-500 hover:bg-brand-50/50 cursor-pointer transition-all flex items-center justify-between"
                      >
                        <div className="pr-2">
                          <h4 className="font-semibold text-slate-900 text-xs">{dish.title}</h4>
                          {dish.description && (
                            <p className="text-[10px] text-slate-500 truncate max-w-xs">{dish.description}</p>
                          )}
                          {!dish.description && dish.notes && (
                            <p className="text-[10px] text-slate-400 italic truncate max-w-xs">{dish.notes}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {dish.courses.map((c) => (
                              <span
                                key={c.id}
                                className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-medium"
                              >
                                {getLocalizedCourseName(c.name, t)}
                              </span>
                            ))}
                            {dish.tags && dish.tags.map((tg) => (
                              <span
                                key={tg.id || tg.name}
                                className="text-[9px] text-white px-1.5 py-0.2 rounded-full font-semibold shadow-2xs"
                                style={{ backgroundColor: tg.color || '#16a34a' }}
                              >
                                {tg.name}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span
                          className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full whitespace-nowrap"
                          style={{
                            backgroundColor: `${dish.status.color}15`,
                            color: dish.status.color,
                          }}
                        >
                          {getLocalizedStatusName(dish.status, t)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* P011 / Issue #8: Meal Attendance Modal */}
      {attendanceModalSlot && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {t('calendar.manage_attendance_title')}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {t('calendar.manage_attendance_subtitle', {
                      meal_type: getLocalizedMealTypeName(attendanceModalSlot.meal_type, t),
                      date: new Intl.DateTimeFormat(currentLocale, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      }).format(parseDate(attendanceModalSlot.date)),
                    })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAttendanceModalSlot(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-600">
                {t('calendar.manage_attendance_hint')}
              </p>

              {/* Diners Attendance Pills (Consistent with TodayView) */}
              <div className="flex flex-wrap gap-2 py-1">
                {members.map((m) => {
                  const isAbsent = draftAbsentIds.has(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        const next = new Set(draftAbsentIds)
                        if (isAbsent) {
                          next.delete(m.id)
                        } else {
                          next.add(m.id)
                        }
                        setDraftAbsentIds(next)
                      }}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                        !isAbsent
                          ? 'bg-brand-50 text-brand-800 border border-brand-300 hover:bg-brand-100 shadow-2xs'
                          : 'bg-slate-100 text-slate-400 line-through border border-dashed border-slate-300 hover:bg-slate-200/70'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: m.avatar_color || '#3B82F6' }}
                      />
                      <span>{m.name}</span>
                      {isAbsent ? (
                        <UserX className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-brand-600" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Live Preview of Attendance Summary */}
              {(() => {
                const draftSummary = getAttendanceSummary(Array.from(draftAbsentIds))
                return (
                  <div className="mt-2 p-2.5 bg-slate-50 rounded-md border border-slate-200/80 flex items-center space-x-2 text-xs">
                    <span className="text-slate-500 font-medium">
                      {t('calendar.attendance_summary_label')}:
                    </span>
                    <div className="flex items-center space-x-1.5 font-bold text-slate-800">
                      <Users className="w-3.5 h-3.5 text-slate-600" />
                      <span>{draftSummary.text || t('calendar.all_present')}</span>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setAttendanceModalSlot(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
              >
                {t('calendar.cancel')}
              </button>
              <button
                type="button"
                disabled={isSavingAttendance}
                onClick={async () => {
                  if (!onSaveSlotAttendance || !attendanceModalSlot) {
                    setAttendanceModalSlot(null)
                    return
                  }
                  try {
                    setIsSavingAttendance(true)
                    await onSaveSlotAttendance(attendanceModalSlot.id, Array.from(draftAbsentIds))
                    setAttendanceModalSlot(null)
                  } catch (err) {
                    console.error('Failed to save attendance:', err)
                  } finally {
                    setIsSavingAttendance(false)
                  }
                }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-md transition-colors shadow-2xs cursor-pointer"
              >
                {isSavingAttendance ? '...' : t('calendar.save_attendance')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Slot Dish Diners Modal (Issue #9) */}
      {editingSlotDish && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isSavingSlotDish && setEditingSlotDish(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md p-4 space-y-4 border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <Utensils className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-semibold text-slate-800">
                  {t('calendar.edit_dish_assignment_title')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingSlotDish(null)}
                disabled={isSavingSlotDish}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dish & Slot Info */}
            <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200/80 space-y-1">
              <div className="text-xs font-semibold text-slate-900">
                {editingSlotDish.dishTitle}
              </div>
              <div className="text-[11px] text-slate-500">
                {new Intl.DateTimeFormat(currentLocale, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                }).format(parseDate(editingSlotDish.slotDate))} • {editingSlotDish.mealTypeName}
              </div>
            </div>

            {/* Diners Assignment Section */}
            <div className="space-y-2 border border-slate-200/80 rounded-md p-3 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700 flex items-center space-x-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>{t('calendar.dish_diners_label')}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditAssignForSpecific(!editAssignForSpecific)
                    if (!editAssignForSpecific) {
                      setEditSelectedMemberIds(
                        editingSlotDish.assignedMemberIds.length > 0
                          ? [...editingSlotDish.assignedMemberIds]
                          : members.map((m) => m.id)
                      )
                    } else {
                      setEditSelectedMemberIds([])
                    }
                  }}
                  className="text-[11px] font-medium text-brand-600 hover:text-brand-700 underline cursor-pointer"
                >
                  {editAssignForSpecific ? t('calendar.assign_all_diners') : t('calendar.alternative_dish_help')}
                </button>
              </div>

              {editAssignForSpecific ? (
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] text-slate-500 block">
                    {t('calendar.select_diners')}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m) => {
                      const isSelected = editSelectedMemberIds.includes(m.id)
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => handleToggleEditMember(m.id)}
                          className={`flex items-center space-x-1.5 px-2 py-1 rounded-full text-xs transition-all border cursor-pointer ${
                            isSelected
                              ? 'bg-brand-50 text-brand-800 border-brand-300 font-semibold shadow-xs'
                              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: m.avatar_color || '#3B82F6' }}
                          />
                          <span>{m.name}</span>
                        </button>
                      )
                    })}
                  </div>
                  {editSelectedMemberIds.length === 0 && (
                    <p className="text-[11px] text-rose-500 italic">
                      {t('calendar.select_at_least_one_diner')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic pt-0.5">
                  {t('calendar.assigned_to_all_diners')}
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingSlotDish(null)}
                disabled={isSavingSlotDish}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveEditSlotDish}
                disabled={isSavingSlotDish || (editAssignForSpecific && editSelectedMemberIds.length === 0)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors shadow-2xs cursor-pointer"
              >
                {isSavingSlotDish ? '...' : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue #22: Print Weekly Menu Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 print:hidden">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-brand-50 text-brand-600 border border-brand-200">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {t('calendar.print_modal_title')}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {t('calendar.print_modal_subtitle')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body: Format selection cards */}
            <div className="p-4 space-y-3">
              {/* Option 1: Vista corrente */}
              <label
                className={`flex items-start space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  printLayout === 'current'
                    ? 'border-brand-500 bg-brand-50/30 shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
                onClick={() => setPrintLayout('current')}
              >
                <input
                  type="radio"
                  name="printLayoutChoice"
                  checked={printLayout === 'current'}
                  onChange={() => setPrintLayout('current')}
                  className="mt-0.5 text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-800">
                      {t('calendar.print_layout_current', {
                        viewName:
                          viewMode === 'compact_h'
                            ? t('calendar.view_horizontal')
                            : viewMode === 'compact_v'
                            ? t('calendar.view_vertical')
                            : t('calendar.view_detailed'),
                      })}
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                      {viewMode === 'compact_h'
                        ? t('calendar.print_orientation_landscape')
                        : t('calendar.print_orientation_portrait')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    {t('calendar.print_layout_current_desc')}
                  </p>
                </div>
              </label>

              {/* Option 2: Planner da Frigo */}
              <label
                className={`flex items-start space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  printLayout === 'fridge'
                    ? 'border-brand-500 bg-brand-50/30 shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
                onClick={() => setPrintLayout('fridge')}
              >
                <input
                  type="radio"
                  name="printLayoutChoice"
                  checked={printLayout === 'fridge'}
                  onChange={() => setPrintLayout('fridge')}
                  className="mt-0.5 text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <span>{t('calendar.print_layout_fridge')}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                        {t('calendar.print_badge_recommended')}
                      </span>
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                      {t('calendar.print_orientation_landscape')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    {t('calendar.print_layout_fridge_desc')}
                  </p>
                </div>
              </label>

              {/* Dimensione Caratteri Stampa */}
              <div className="pt-2 border-t border-slate-200">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  {t('calendar.print_font_size_label')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintFontSize('normal')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer text-center ${
                      printFontSize === 'normal'
                        ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-2xs ring-1 ring-brand-500'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {t('calendar.print_font_size_normal')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintFontSize('large')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer text-center ${
                      printFontSize === 'large'
                        ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-2xs ring-1 ring-brand-500'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {t('calendar.print_font_size_large')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintFontSize('xlarge')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer text-center ${
                      printFontSize === 'xlarge'
                        ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-2xs ring-1 ring-brand-500'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {t('calendar.print_font_size_xlarge')}
                  </button>
                </div>
              </div>

              {/* Info Badges */}
              <div className="flex items-center space-x-2 pt-1 text-[10px] text-slate-500">
                <span className="inline-flex items-center space-x-1 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium">
                  <span>📄</span>
                  <span>{t('calendar.print_format_badge')}</span>
                </span>
                <span className="inline-flex items-center space-x-1 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium">
                  <span>🎨</span>
                  <span>{t('calendar.print_palette_badge')}</span>
                </span>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleTriggerPrint(printLayout)}
                className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{t('calendar.print_confirm_btn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dish View & Edit Modal */}
      {editingDishForDetail && (
        <DishModal
          isOpen={true}
          onClose={() => setEditingDishForDetail(null)}
          dish={editingDishForDetail}
          courses={courses}
          statuses={statuses}
          sources={sources}
          availableTags={availableTags}
          dishes={dishes}
          onSave={async (payload, dishId) => {
            if (dishId && onUpdateDish) {
              await onUpdateDish(dishId, payload)
            }
            setEditingDishForDetail(null)
          }}
          onSetPreference={onSetPreference}
        />
      )}
    </div>
  )
}
