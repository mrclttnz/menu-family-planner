export interface ThemePreset {
  id: string
  nameKey: string
  hex: string
}

export const DEFAULT_THEME_HEX = '#16a34a'
export const THEME_STORAGE_KEY = 'menu_design_theme_color'

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'emerald', nameKey: 'theme.emerald', hex: '#16a34a' },
  { id: 'teal', nameKey: 'theme.teal', hex: '#0d9488' },
  { id: 'blue', nameKey: 'theme.blue', hex: '#2563eb' },
  { id: 'indigo', nameKey: 'theme.indigo', hex: '#4f46e5' },
  { id: 'purple', nameKey: 'theme.purple', hex: '#7c3aed' },
  { id: 'pink', nameKey: 'theme.pink', hex: '#db2777' },
  { id: 'red', nameKey: 'theme.red', hex: '#dc2626' },
  { id: 'orange', nameKey: 'theme.orange', hex: '#ea580c' },
  { id: 'amber', nameKey: 'theme.amber', hex: '#d97706' },
  { id: 'lime', nameKey: 'theme.lime', hex: '#65a30d' },
  { id: 'slate', nameKey: 'theme.slate', hex: '#475569' },
]

export interface RgbColor {
  r: number
  g: number
  b: number
}

export interface HslColor {
  h: number
  s: number
  l: number
}

export interface ThemeShades {
  50: RgbColor
  100: RgbColor
  200: RgbColor
  300: RgbColor
  400: RgbColor
  500: RgbColor
  600: RgbColor
  700: RgbColor
  800: RgbColor
  900: RgbColor
}

/**
 * Normalizes hex string to standard 6-char hex with leading #.
 */
export function normalizeHex(hex: string): string {
  let clean = hex.trim().replace(/^#/, '')
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('')
  }
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) {
    return DEFAULT_THEME_HEX
  }
  return '#' + clean.toLowerCase()
}

/**
 * Converts a hex color string to RGB.
 */
export function hexToRgb(hex: string): RgbColor {
  const norm = normalizeHex(hex).slice(1)
  const num = parseInt(norm, 16)
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  }
}

/**
 * Converts RGB to HSL.
 */
export function rgbToHsl(r: number, g: number, b: number): HslColor {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

/**
 * Converts HSL to RGB.
 */
export function hslToRgb(h: number, s: number, l: number): RgbColor {
  h = ((h % 360) + 360) % 360
  s = Math.max(0, Math.min(100, s)) / 100
  l = Math.max(0, Math.min(100, l)) / 100

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let rPrime = 0
  let gPrime = 0
  let bPrime = 0

  if (h >= 0 && h < 60) {
    rPrime = c
    gPrime = x
    bPrime = 0
  } else if (h >= 60 && h < 120) {
    rPrime = x
    gPrime = c
    bPrime = 0
  } else if (h >= 120 && h < 180) {
    rPrime = 0
    gPrime = c
    bPrime = x
  } else if (h >= 180 && h < 240) {
    rPrime = 0
    gPrime = x
    bPrime = c
  } else if (h >= 240 && h < 300) {
    rPrime = x
    gPrime = 0
    bPrime = c
  } else {
    rPrime = c
    gPrime = 0
    bPrime = x
  }

  return {
    r: Math.round((rPrime + m) * 255),
    g: Math.round((gPrime + m) * 255),
    b: Math.round((bPrime + m) * 255),
  }
}

/**
 * Converts RGB color to CSS RGB string format e.g. "22 163 74".
 */
export function rgbToCssChannels(color: RgbColor): string {
  return `${color.r} ${color.g} ${color.b}`
}

/**
 * Converts RGB to hex string.
 */
export function rgbToHex(color: RgbColor): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`
}

/**
 * Generates the full 10-shade Tailwind-like palette from any base hex color.
 */
export function generateThemeShades(baseHex: string): ThemeShades {
  const cleanHex = normalizeHex(baseHex)
  const baseRgb = hexToRgb(cleanHex)
  const hsl = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b)

  const h = hsl.h
  const s = hsl.s

  return {
    50: hslToRgb(h, Math.min(s * 0.75, 75), 97),
    100: hslToRgb(h, Math.min(s * 0.8, 85), 92),
    200: hslToRgb(h, Math.min(s * 0.85, 90), 84),
    300: hslToRgb(h, Math.min(s * 0.9, 90), 72),
    400: hslToRgb(h, Math.min(s * 0.95, 92), 58),
    500: hslToRgb(h, s, 48),
    600: baseRgb, // The chosen base color is anchored at 600
    700: hslToRgb(h, Math.min(s * 1.05, 95), 32),
    800: hslToRgb(h, Math.min(s * 1.08, 95), 24),
    900: hslToRgb(h, Math.min(s * 1.1, 95), 16),
  }
}

/**
 * Applies the generated shades as CSS Custom Properties on document root.
 */
export function applyTheme(baseHex: string): void {
  if (typeof document === 'undefined') return

  const cleanHex = normalizeHex(baseHex)
  const shades = generateThemeShades(cleanHex)
  const root = document.documentElement

  const keys: (keyof ThemeShades)[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]
  keys.forEach((key) => {
    root.style.setProperty(`--color-brand-${key}`, rgbToCssChannels(shades[key]))
  })

  // Store in localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(THEME_STORAGE_KEY, cleanHex)
  }
}

/**
 * Retrieves the currently active theme base color.
 */
export function getSavedTheme(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (saved) {
      return normalizeHex(saved)
    }
  }
  return DEFAULT_THEME_HEX
}

/**
 * Initializes the theme from localStorage on page startup.
 */
export function initTheme(): string {
  const theme = getSavedTheme()
  applyTheme(theme)
  return theme
}
