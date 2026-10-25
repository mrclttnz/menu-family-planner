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
  assignDishToSlot: (slotId: number, payload: { dish_id: number; sort_order?: number; notes?: string }) =>
    request<MealSlot>(`/calendar/slots/${slotId}/dishes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  removeDishFromSlot: (slotId: number, dishId: number) =>
    request<MealSlot>(`/calendar/slots/${slotId}/dishes/${dishId}`, {
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
