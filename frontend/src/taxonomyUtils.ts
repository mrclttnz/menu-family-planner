import { TFunction } from 'i18next'
import { MealType } from './types'

export function getLocalizedMealTypeName(mealType: MealType, t: TFunction): string {
  if (mealType.code) {
    const key = `taxonomies.meal_types.${mealType.code}`
    const translated = t(key)
    if (translated && translated !== key) return translated
  }
  return mealType.name
}

export function getLocalizedStatusName(status: { code?: string; name: string }, t: TFunction): string {
  if (status.code) {
    const key = `taxonomies.dish_statuses.${status.code}`
    const translated = t(key)
    if (translated && translated !== key) return translated
  }
  return status.name
}

export function getLocalizedCourseName(courseName: string, t: TFunction): string {
  const key = `taxonomies.courses.${courseName}`
  const translated = t(key)
  return translated && translated !== key ? translated : courseName
}

export function getLocalizedSourceName(sourceName: string, t: TFunction): string {
  const key = `taxonomies.sources.${sourceName}`
  const translated = t(key)
  return translated && translated !== key ? translated : sourceName
}
