import { useState, useEffect, useCallback } from 'react'
import { api, getToken, clearToken } from './api'
import {
  Household,
  Member,
  MealType,
  DishStatus,
  CourseType,
  SourceType,
  Dish,
  MealSlot,
} from './types'
import { formatDate, getWeekRangeContaining } from './dateUtils'
import { Navbar } from './components/Navbar'
import { AuthModal } from './components/AuthModal'
import { TodayView } from './components/TodayView'
import { CalendarView } from './components/CalendarView'
import { DishesView } from './components/DishesView'
import { MembersView } from './components/MembersView'
import { Loader2 } from 'lucide-react'

export function App() {
  const [household, setHousehold] = useState<Household | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'today' | 'calendar' | 'dishes' | 'members'>('today')

  // Domain state
  const [members, setMembers] = useState<Member[]>([])
  const [mealTypes, setMealTypes] = useState<MealType[]>([])
  const [statuses, setStatuses] = useState<DishStatus[]>([])
  const [courses, setCourses] = useState<CourseType[]>([])
  const [sources, setSources] = useState<SourceType[]>([])
  const [dishes, setDishes] = useState<Dish[]>([])
  const [calendarSlots, setCalendarSlots] = useState<MealSlot[]>([])

  // P005: Week start day preference (1=Lunedì, 6=Sabato, 0=Domenica, -1=Oggi)
  const [weekStartDay, setWeekStartDay] = useState<number>(() => {
    const saved = localStorage.getItem('menu_design_week_start_day')
    return saved !== null ? parseInt(saved, 10) : 1
  })

  // Calendar date range: 7 days aligned with weekStartDay containing today
  const [calendarRange, setCalendarRange] = useState(() => {
    const saved = localStorage.getItem('menu_design_week_start_day')
    const startDay = saved !== null ? parseInt(saved, 10) : 1
    return getWeekRangeContaining(new Date(), startDay)
  })

  const startDate = calendarRange.startDate
  const endDate = calendarRange.endDate

  const handleDateRangeChange = (start: string, end: string) => {
    setCalendarRange({ startDate: start, endDate: end })
  }

  const handleChangeWeekStartDay = (newStartDay: number) => {
    setWeekStartDay(newStartDay)
    localStorage.setItem('menu_design_week_start_day', String(newStartDay))
    const range = getWeekRangeContaining(new Date(), newStartDay)
    setCalendarRange(range)
  }

  const handleResetToCurrentWeek = () => {
    const range = getWeekRangeContaining(new Date(), weekStartDay)
    setCalendarRange(range)
  }

  const todayStr = formatDate(new Date())

  // Initial load: verify auth
  useEffect(() => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }

    api
      .getMe()
      .then((data) => {
        setHousehold(data)
      })
      .catch(() => {
        clearToken()
        setHousehold(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  // Load domain data when household authenticated
  const loadDomainData = useCallback(async () => {
    if (!household) return

    try {
      const [membersData, mealTypesData, statusesData, coursesData, sourcesData, dishesData, calendarData] =
        await Promise.all([
          api.getMembers(),
          api.getMealTypes(),
          api.getStatuses(),
          api.getCourses(),
          api.getSources(),
          api.getDishes(),
          api.getCalendar(startDate, endDate),
        ])

      setMembers(membersData)
      setMealTypes(mealTypesData)
      setStatuses(statusesData)
      setCourses(coursesData)
      setSources(sourcesData)
      setDishes(dishesData)
      setCalendarSlots(calendarData)
    } catch (err) {
      console.error('Failed to load application data:', err)
    }
  }, [household, startDate, endDate])

  useEffect(() => {
    if (household) {
      loadDomainData()
    }
  }, [household, loadDomainData])

  const handleLogout = () => {
    clearToken()
    setHousehold(null)
  }

  // Attendance Toggle (Exception-based)
  const handleToggleAttendance = async (slotId: number, memberId: number, isCurrentlyAbsent: boolean) => {
    try {
      // If currently absent, set is_attending to true (clear absence)
      // If currently attending, set is_attending to false (record exception)
      const targetState = isCurrentlyAbsent ? true : false
      await api.toggleAttendance(slotId, memberId, targetState)
      // Refresh calendar slots to re-evaluate real-time compatibility alerts!
      const updatedCalendar = await api.getCalendar(startDate, endDate)
      setCalendarSlots(updatedCalendar)
    } catch (err) {
      console.error('Failed to toggle attendance:', err)
    }
  }

  // Assign Dish to Slot (supports alternative dishes with assigned_member_ids)
  const handleAssignDish = async (slotId: number, dishId?: number, assignedMemberIds?: number[]) => {
    if (!dishId) {
      setActiveTab('calendar')
      return
    }
    try {
      await api.assignDishToSlot(slotId, { dish_id: dishId, assigned_member_ids: assignedMemberIds })
      const updatedCalendar = await api.getCalendar(startDate, endDate)
      setCalendarSlots(updatedCalendar)
    } catch (err) {
      console.error('Failed to assign dish:', err)
    }
  }

  // Remove Dish from Slot
  const handleRemoveDish = async (slotId: number, dishId: number) => {
    try {
      await api.removeDishFromSlot(slotId, dishId)
      const updatedCalendar = await api.getCalendar(startDate, endDate)
      setCalendarSlots(updatedCalendar)
    } catch (err) {
      console.error('Failed to remove dish:', err)
    }
  }

  // Add Note to Slot Dish (J001)
  const handleAddSlotDishNote = async (slotId: number, dishId: number, note: string) => {
    try {
      await api.addSlotDishNote(slotId, dishId, note)
      const updatedCalendar = await api.getCalendar(startDate, endDate)
      setCalendarSlots(updatedCalendar)
    } catch (err) {
      console.error('Failed to add note:', err)
    }
  }

  // Delete Note from Slot Dish (J001)
  const handleDeleteSlotDishNote = async (slotId: number, dishId: number, noteId: number) => {
    try {
      await api.deleteSlotDishNote(slotId, dishId, noteId)
      const updatedCalendar = await api.getCalendar(startDate, endDate)
      setCalendarSlots(updatedCalendar)
    } catch (err) {
      console.error('Failed to delete note:', err)
    }
  }

  // Set Meal Rating for a Dish in a Specific Slot (J002)
  const handleSetSlotDishRating = async (
    slotId: number,
    dishId: number,
    memberId: number,
    rating: 'thumbs_up' | 'neutral' | 'thumbs_down'
  ) => {
    try {
      await api.setSlotDishRating(slotId, dishId, memberId, rating)
      const updatedCalendar = await api.getCalendar(startDate, endDate)
      setCalendarSlots(updatedCalendar)
    } catch (err) {
      console.error('Failed to set meal rating:', err)
    }
  }

  // Delete/Toggle Off Meal Rating for a Dish (J003)
  const handleDeleteSlotDishRating = async (slotId: number, dishId: number, memberId: number) => {
    try {
      await api.deleteSlotDishRating(slotId, dishId, memberId)
      const updatedCalendar = await api.getCalendar(startDate, endDate)
      setCalendarSlots(updatedCalendar)
    } catch (err) {
      console.error('Failed to delete meal rating:', err)
    }
  }

  // Add Custom Slot (e.g. Brunch, Merenda)
  const handleAddCustomSlot = async (date: string, mealTypeId: number) => {
    try {
      await api.createCustomSlot({ date, meal_type_id: mealTypeId })
      const updatedCalendar = await api.getCalendar(startDate, endDate)
      setCalendarSlots(updatedCalendar)
    } catch (err) {
      console.error('Failed to create custom slot:', err)
    }
  }

  // Delete Slot
  const handleDeleteSlot = async (slotId: number) => {
    try {
      await api.deleteSlot(slotId)
      const updatedCalendar = await api.getCalendar(startDate, endDate)
      setCalendarSlots(updatedCalendar)
    } catch (err) {
      console.error('Failed to delete slot:', err)
    }
  }

  // Create Dish
  const handleCreateDish = async (payload: Parameters<typeof api.createDish>[0]) => {
    const newDish = await api.createDish(payload)
    const [dishesData, calendarData] = await Promise.all([
      api.getDishes(),
      api.getCalendar(startDate, endDate),
    ])
    setDishes(dishesData)
    setCalendarSlots(calendarData)
    return newDish
  }

  // Delete Meal Type Slots for the current week range (P009)
  const handleDeleteMealTypeSlots = async (mealTypeId: number) => {
    try {
      await api.deleteSlotsByMealType(mealTypeId, startDate, endDate)
      const updatedCalendar = await api.getCalendar(startDate, endDate)
      setCalendarSlots(updatedCalendar)
    } catch (err) {
      console.error('Failed to delete meal type slots:', err)
    }
  }

  // Update/Delete Meal Slot Notes (P010)
  const handleUpdateSlotNotes = async (slotId: number, notes: string | null) => {
    try {
      const updatedSlot = await api.updateSlotNotes(slotId, notes)
      setCalendarSlots((prev) => prev.map((s) => (s.id === slotId ? updatedSlot : s)))
    } catch (err) {
      console.error('Failed to update slot notes:', err)
    }
  }

  // Update Dish (G001/D004)
  const handleUpdateDish = async (dishId: number, payload: Parameters<typeof api.updateDish>[1]) => {
    await api.updateDish(dishId, payload)
    const [dishesData, calendarData] = await Promise.all([
      api.getDishes(),
      api.getCalendar(startDate, endDate),
    ])
    setDishes(dishesData)
    setCalendarSlots(calendarData)
  }

  // Delete Dish
  const handleDeleteDish = async (dishId: number) => {
    await api.deleteDish(dishId)
    const [dishesData, calendarData] = await Promise.all([
      api.getDishes(),
      api.getCalendar(startDate, endDate),
    ])
    setDishes(dishesData)
    setCalendarSlots(calendarData)
  }

  // Set Member Preference
  const handleSetPreference = async (dishId: number, memberId: number, rating: 'favorite' | 'neutral' | 'dislike') => {
    await api.setPreference(dishId, memberId, rating)
    const [dishesData, calendarData] = await Promise.all([
      api.getDishes(),
      api.getCalendar(startDate, endDate),
    ])
    setDishes(dishesData)
    setCalendarSlots(calendarData)
  }

  // Add Member
  const handleAddMember = async (payload: Parameters<typeof api.createMember>[0]) => {
    await api.createMember(payload)
    const [membersData, dishesData, calendarData] = await Promise.all([
      api.getMembers(),
      api.getDishes(),
      api.getCalendar(startDate, endDate),
    ])
    setMembers(membersData)
    setDishes(dishesData)
    setCalendarSlots(calendarData)
  }

  // Update Member (G001)
  const handleUpdateMember = async (id: number, payload: Parameters<typeof api.updateMember>[1]) => {
    await api.updateMember(id, payload)
    const [membersData, dishesData, calendarData] = await Promise.all([
      api.getMembers(),
      api.getDishes(),
      api.getCalendar(startDate, endDate),
    ])
    setMembers(membersData)
    setDishes(dishesData)
    setCalendarSlots(calendarData)
  }

  // Delete Member
  const handleDeleteMember = async (id: number) => {
    await api.deleteMember(id)
    const [membersData, dishesData, calendarData] = await Promise.all([
      api.getMembers(),
      api.getDishes(),
      api.getCalendar(startDate, endDate),
    ])
    setMembers(membersData)
    setDishes(dishesData)
    setCalendarSlots(calendarData)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      </div>
    )
  }

  // Unauthenticated: Show Auth Modal
  if (!household) {
    return <AuthModal onSuccess={(h) => setHousehold(h)} />
  }

  // Today's slots
  const todaySlots = calendarSlots.filter((s) => s.date === todayStr)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar
        household={household}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-full xl:max-w-[1550px] w-full mx-auto px-2 sm:px-3 pt-1.5 pb-4">
        {activeTab === 'today' && (
          <TodayView
            slots={todaySlots}
            members={members}
            dishes={dishes}
            onToggleAttendance={handleToggleAttendance}
            onAssignDish={(slotId) => {
              setActiveTab('calendar')
              console.log(slotId)
            }}
            onRemoveDish={handleRemoveDish}
            onAddSlotDishNote={handleAddSlotDishNote}
            onDeleteSlotDishNote={handleDeleteSlotDishNote}
            onSetSlotDishRating={handleSetSlotDishRating}
            onDeleteSlotDishRating={handleDeleteSlotDishRating}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            slots={calendarSlots}
            members={members}
            dishes={dishes}
            mealTypes={mealTypes}
            courses={courses}
            statuses={statuses}
            startDate={startDate}
            endDate={endDate}
            weekStartDay={weekStartDay}
            onChangeWeekStartDay={handleChangeWeekStartDay}
            onResetToCurrentWeek={handleResetToCurrentWeek}
            onDateRangeChange={handleDateRangeChange}
            onAddCustomSlot={handleAddCustomSlot}
            onDeleteSlot={handleDeleteSlot}
            onDeleteMealTypeSlots={handleDeleteMealTypeSlots}
            onUpdateSlotNotes={handleUpdateSlotNotes}
            onAssignDish={handleAssignDish}
            onCreateDish={handleCreateDish}
            onRemoveDish={handleRemoveDish}
            onAddSlotDishNote={handleAddSlotDishNote}
            onDeleteSlotDishNote={handleDeleteSlotDishNote}
            onSetSlotDishRating={handleSetSlotDishRating}
            onDeleteSlotDishRating={handleDeleteSlotDishRating}
          />
        )}

        {activeTab === 'dishes' && (
          <DishesView
            dishes={dishes}
            statuses={statuses}
            courses={courses}
            sources={sources}
            onCreateDish={handleCreateDish}
            onUpdateDish={handleUpdateDish}
            onDeleteDish={handleDeleteDish}
            onSetPreference={handleSetPreference}
            onRefreshDishes={loadDomainData}
          />
        )}

        {activeTab === 'members' && (
          <MembersView
            members={members}
            onAddMember={handleAddMember}
            onUpdateMember={handleUpdateMember}
            onDeleteMember={handleDeleteMember}
          />
        )}
      </main>
    </div>
  )
}

export default App
