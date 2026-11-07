import i18n from './i18n'

export interface PydanticErrorItem {
  type?: string
  loc?: (string | number)[]
  msg?: string
  input?: unknown
  ctx?: Record<string, unknown>
}

const BACKEND_MESSAGE_TO_KEY: Record<string, string> = {
  'Invalid household credentials.': 'errors.invalid_credentials',
  'Household name already registered.': 'errors.household_name_exists',
  'A dish with this name already exists in the catalog.': 'errors.dish_duplicate_name',
  'Dish title cannot be empty.': 'errors.title_required',
  'Dish title cannot be empty or whitespace only': 'errors.title_required',
  'Dish must have at least one course.': 'errors.courses_required',
  'One or more course_ids are invalid.': 'errors.invalid_courses',
  'Invalid status_id for this household.': 'errors.invalid_status',
  'Invalid status_id.': 'errors.invalid_status',
  'Dish not found.': 'errors.dish_not_found',
  'Dish not found in catalog.': 'errors.dish_not_found',
  'Member not found.': 'errors.member_not_found',
  'A member with this name already exists in your household.': 'errors.member_name_exists',
  'Meal slot not found.': 'errors.meal_slot_not_found',
  'Meal slot already exists for this date and meal type.': 'errors.meal_slot_exists',
  'end_date must be >= start_date': 'errors.date_range_invalid',
  'Date range maximum is 31 days': 'errors.date_range_max',
  'Default status cannot be deleted.': 'errors.default_status_cannot_delete',
  'Cannot delete system status.': 'errors.system_status_cannot_delete',
  'System meal types cannot be deleted.': 'errors.system_meal_type_cannot_delete',
  'Tag with this name already exists.': 'errors.tag_name_exists',
  'Tag not found.': 'errors.not_found',
}

/**
 * Formats a single Pydantic error item into a user-friendly, localized message.
 */
export function formatPydanticErrorItem(err: PydanticErrorItem): string {
  const loc = err.loc || []
  const field = loc.length > 0 ? String(loc[loc.length - 1]) : ''
  const errorType = err.type || ''
  const rawMsg = err.msg || ''

  // 1. Specific known fields
  if (field === 'course_ids') {
    return i18n.t('errors.courses_required')
  }

  if (field === 'title') {
    return i18n.t('errors.title_required')
  }

  if (field === 'source_url') {
    return i18n.t('errors.invalid_url')
  }

  // 2. Value error messages (cleaned from Pydantic prefix)
  const cleanMsg = rawMsg.replace(/^Value error,\s*/i, '').trim()
  if (BACKEND_MESSAGE_TO_KEY[cleanMsg]) {
    return i18n.t(BACKEND_MESSAGE_TO_KEY[cleanMsg])
  }

  if (cleanMsg.includes('source_url must start with')) {
    return i18n.t('errors.invalid_url')
  }

  if (cleanMsg.includes('Dish title cannot be empty')) {
    return i18n.t('errors.title_required')
  }

  // 3. Generic field-based messages
  if (errorType === 'missing' || errorType === 'string_too_short' || errorType === 'too_short') {
    if (field) {
      return i18n.t('errors.field_required', { field })
    }
  }

  if (cleanMsg) {
    return cleanMsg
  }

  return i18n.t('errors.invalid_input')
}

/**
 * Parses API error response and converts technical details into friendly localized messages.
 */
export function parseApiError(
  responseStatus: number,
  errorData: unknown
): string {
  if (errorData && typeof errorData === 'object') {
    const errorObj = errorData as Record<string, unknown>
    const detail = errorObj.detail

    // Case 1: FastAPI RequestValidationError array
    if (Array.isArray(detail) && detail.length > 0) {
      const messages = detail
        .map((item) => {
          if (typeof item === 'object' && item !== null) {
            return formatPydanticErrorItem(item as PydanticErrorItem)
          }
          return typeof item === 'string' ? item : null
        })
        .filter((msg): msg is string => Boolean(msg && msg.trim()))

      if (messages.length > 0) {
        // Return unique messages joined by period or bullet
        const uniqueMessages = Array.from(new Set(messages))
        return uniqueMessages.join('. ')
      }
    }

    // Case 2: FastAPI detail is a single string
    if (typeof detail === 'string' && detail.trim()) {
      const trimmed = detail.trim()
      if (BACKEND_MESSAGE_TO_KEY[trimmed]) {
        return i18n.t(BACKEND_MESSAGE_TO_KEY[trimmed])
      }
      return trimmed
    }

    // Case 3: Other error keys (message, error)
    if (typeof errorObj.message === 'string' && errorObj.message.trim()) {
      return errorObj.message.trim()
    }
  }

  // Case 4: Status code fallbacks
  switch (responseStatus) {
    case 401:
      return i18n.t('errors.unauthorized')
    case 403:
      return i18n.t('errors.forbidden')
    case 404:
      return i18n.t('errors.not_found')
    case 422:
      return i18n.t('errors.invalid_input')
    case 500:
    case 502:
    case 503:
      return i18n.t('errors.server_error')
    default:
      return i18n.t('errors.default')
  }
}
