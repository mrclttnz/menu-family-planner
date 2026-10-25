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

  // Calendar date range (7 days default: today -> today + 6)
  const todayStr = new Date().toISOString().split('T')[0]
  const defaultEnd = new Date()
  defaultEnd.setDate(defaultEnd.getDate() + 6)
  const defaultEndStr = defaultEnd.toISOString().split('T')[0]

  const [startDate, setStartDate] = useState(todayStr)
  const [endDate, setEndDate] = useState(defaultEndStr)

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

  // Assign Dish to Slot
  const handleAssignDish = async (slotId: number, dishId?: number) => {
    if (!dishId) {
      setActiveTab('calendar')
      return
    }
    try {
      await api.assignDishToSlot(slotId, { dish_id: dishId })
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
    await api.createDish(payload)
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

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-6">
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
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            slots={calendarSlots}
            members={members}
            dishes={dishes}
            mealTypes={mealTypes}
            startDate={startDate}
            endDate={endDate}
            onDateRangeChange={(start, end) => {
              setStartDate(start)
              setEndDate(end)
            }}
            onAddCustomSlot={handleAddCustomSlot}
            onDeleteSlot={handleDeleteSlot}
            onAssignDish={handleAssignDish}
            onRemoveDish={handleRemoveDish}
          />
        )}

        {activeTab === 'dishes' && (
          <DishesView
            dishes={dishes}
            statuses={statuses}
            courses={courses}
            sources={sources}
            onCreateDish={handleCreateDish}
            onDeleteDish={handleDeleteDish}
            onSetPreference={handleSetPreference}
          />
        )}

        {activeTab === 'members' && (
          <MembersView
            members={members}
            onAddMember={handleAddMember}
            onDeleteMember={handleDeleteMember}
          />
        )}
      </main>
    </div>
  )
}

export default App
