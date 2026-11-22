import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import i18n from '../i18n'

// Tests run against the real IT/EN resources; start every test in English.
beforeEach(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
