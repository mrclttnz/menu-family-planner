import {
  Household,
  Member,
  MealType,
  DishStatus,
  CourseType,
  SourceType,
  Dish,
  MealSlot,
  MealSlotAttendance,
  SlotDishNote,
  DishImportResult,
} from './types'

const TOKEN_KEY = 'menu_design_jwt_token'

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY)

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers = new Headers(options.headers || {})

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`/api/v1${endpoint}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    clearToken()
  }

  if (!response.ok) {
    let errorDetail = 'Si è verificato un errore.'
    try {
      const errorJson = await response.json()
      if (errorJson.detail) {
        errorDetail = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail)
      }
    } catch {
      errorDetail = response.statusText || errorDetail
    }
    throw new Error(errorDetail)
  }

  if (response.status === 204) {
    return null as unknown as T
  }

  return response.json()
}

export const api = {
  // Auth
  register: (payload: { name: string; email: string; password: string }) =>
    request<{ access_token: string; household: Household }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    request<{ access_token: string; household: Household }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMe: () => request<Household>('/auth/me'),

  // Members
  getMembers: () => request<Member[]>('/members'),
  createMember: (payload: { name: string; avatar_color?: string; is_child?: boolean }) =>
    request<Member>('/members', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMember: (id: number, payload: { name?: string; avatar_color?: string; is_child?: boolean }) =>
    request<Member>(`/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteMember: (id: number) =>
    request<void>(`/members/${id}`, {
      method: 'DELETE',
    }),

  // Taxonomies
  getMealTypes: () => request<MealType[]>('/taxonomies/meal-types'),
  getStatuses: () => request<DishStatus[]>('/taxonomies/statuses'),
  getCourses: () => request<CourseType[]>('/taxonomies/courses'),
  createCourse: (payload: { name: string; sort_order?: number }) =>
    request<CourseType>('/taxonomies/courses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getSources: () => request<SourceType[]>('/taxonomies/sources'),

  // Dishes & Preferences
  getDishes: (params?: { status_id?: number; course_id?: number; search?: string }) => {
    const query = new URLSearchParams()
    if (params?.status_id) query.set('status_id', params.status_id.toString())
    if (params?.course_id) query.set('course_id', params.course_id.toString())
    if (params?.search) query.set('search', params.search)
    return request<Dish[]>(`/dishes?${query.toString()}`)
  },
  createDish: (payload: {
    title: string
    description?: string
    notes?: string
    status_id: number
    course_ids: number[]
    source_type_id?: number
    source_reference?: string
    source_url?: string
  }) =>
    request<Dish>('/dishes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateDish: (id: number, payload: Partial<{
    title: string
    description: string
    notes: string
    status_id: number
    course_ids: number[]
    source_type_id: number
    source_reference: string
    source_url: string
  }>) =>
    request<Dish>(`/dishes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteDish: (id: number) =>
    request<void>(`/dishes/${id}`, {
      method: 'DELETE',
    }),
  setPreference: (dishId: number, memberId: number, rating: 'favorite' | 'neutral' | 'dislike') =>
    request<{ dish_id: number; member_id: number; rating: string }>(`/dishes/${dishId}/preferences/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify({ rating }),
    }),
  getDishNotes: (dishId: number) => request<SlotDishNote[]>(`/dishes/${dishId}/notes`),

  exportDishes: async (format: 'xlsx' | 'csv', params?: { status_id?: number; course_id?: number; search?: string }) => {
    const token = getToken()
    const query = new URLSearchParams()
    query.set('format', format)
    if (params?.status_id) query.set('status_id', params.status_id.toString())
    if (params?.course_id) query.set('course_id', params.course_id.toString())
    if (params?.search) query.set('search', params.search)

    const headers: HeadersInit = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(`/api/v1/dishes/export?${query.toString()}`, { headers })
    if (!res.ok) throw new Error('Errore durante l\'esportazione dei piatti.')
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    a.download = `piatti_${dateStr}.${format}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  },

  downloadImportTemplate: async (format: 'xlsx' | 'csv') => {
    const token = getToken()
    const headers: HeadersInit = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(`/api/v1/dishes/import-template?format=${format}`, { headers })
    if (!res.ok) throw new Error('Errore durante il download del template.')
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `template_import_piatti.${format}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  },

  importDishes: async (file: File, mode: 'skip' | 'update'): Promise<DishImportResult> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('mode', mode)
    return request<DishImportResult>('/dishes/import', {
      method: 'POST',
      body: formData,
    })
  },

  // Calendar
  getCalendar: (startDate: string, endDate: string) =>
    request<MealSlot[]>(`/calendar?start_date=${startDate}&end_date=${endDate}`),
  createCustomSlot: (payload: { date: string; meal_type_id: number; notes?: string }) =>
    request<MealSlot>('/calendar/slots', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteSlot: (slotId: number) =>
    request<void>(`/calendar/slots/${slotId}`, {
      method: 'DELETE',
    }),
  updateSlotNotes: (slotId: number, notes: string | null) =>
    request<MealSlot>(`/calendar/slots/${slotId}/notes`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    }),
  deleteSlotsByMealType: (mealTypeId: number, startDate: string, endDate: string) =>
    request<void>(`/calendar/slots/by-meal-type?meal_type_id=${mealTypeId}&start_date=${startDate}&end_date=${endDate}`, {
      method: 'DELETE',
    }),
  assignDishToSlot: (
    slotId: number,
    payload: { dish_id: number; sort_order?: number; notes?: string; assigned_member_ids?: number[] }
  ) =>
    request<MealSlot>(`/calendar/slots/${slotId}/dishes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  removeDishFromSlot: (slotId: number, dishId: number) =>
    request<MealSlot>(`/calendar/slots/${slotId}/dishes/${dishId}`, {
      method: 'DELETE',
    }),
  addSlotDishNote: (slotId: number, dishId: number, note: string) =>
    request<MealSlot>(`/calendar/slots/${slotId}/dishes/${dishId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  deleteSlotDishNote: (slotId: number, dishId: number, noteId: number) =>
    request<MealSlot>(`/calendar/slots/${slotId}/dishes/${dishId}/notes/${noteId}`, {
      method: 'DELETE',
    }),
  setSlotDishRating: (
    slotId: number,
    dishId: number,
    memberId: number,
    rating: 'thumbs_up' | 'neutral' | 'thumbs_down'
  ) =>
    request<MealSlot>(`/calendar/slots/${slotId}/dishes/${dishId}/ratings`, {
      method: 'POST',
      body: JSON.stringify({ member_id: memberId, rating }),
    }),
  deleteSlotDishRating: (slotId: number, dishId: number, memberId: number) =>
    request<MealSlot>(`/calendar/slots/${slotId}/dishes/${dishId}/ratings/${memberId}`, {
      method: 'DELETE',
    }),

  // Attendance (Exception-based)
  getAttendance: (startDate: string, endDate: string) =>
    request<MealSlotAttendance[]>(`/attendance?start_date=${startDate}&end_date=${endDate}`),
  toggleAttendance: (slotId: number, memberId: number, isAttending: boolean) =>
    request<MealSlotAttendance>(`/attendance/${slotId}/members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify({ is_attending: isAttending }),
    }),
}
