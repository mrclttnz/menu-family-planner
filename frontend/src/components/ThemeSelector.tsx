import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Palette, RotateCcw, X, Sparkles } from 'lucide-react'
import {
  THEME_PRESETS,
  DEFAULT_THEME_HEX,
  getSavedTheme,
  applyTheme,
  generateThemeShades,
  rgbToHex,
  normalizeHex,
} from '../themeUtils'

interface ThemeSelectorProps {
  isOpen: boolean
  onClose: () => void
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation()
  const modalRef = useRef<HTMLDivElement>(null)

  const [activeTheme, setActiveTheme] = useState<string>(DEFAULT_THEME_HEX)
  const [customHex, setCustomHex] = useState<string>(DEFAULT_THEME_HEX)
  const [hexInputError, setHexInputError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      const current = getSavedTheme()
      setActiveTheme(current)
      setCustomHex(current)
      setHexInputError(null)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSelectTheme = (hex: string) => {
    const normalized = normalizeHex(hex)
    setActiveTheme(normalized)
    setCustomHex(normalized)
    setHexInputError(null)
    applyTheme(normalized)
  }

  const handleCustomHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.trim()
    if (!val.startsWith('#') && val.length > 0) {
      val = '#' + val
    }
    setCustomHex(val)

    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) {
      setHexInputError(null)
      const normalized = normalizeHex(val)
      setActiveTheme(normalized)
      applyTheme(normalized)
    } else {
      setHexInputError(t('tags.invalid_hex', 'Codice HEX non valido'))
    }
  }

  const handleResetDefault = () => {
    handleSelectTheme(DEFAULT_THEME_HEX)
  }

  // Preview shades for the currently selected theme
  const previewShades = generateThemeShades(activeTheme)
  const shadeKeys = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-lg p-5 sm:p-6 overflow-y-auto max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 shadow-2xs">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5">
                {t('theme.title', 'Tema & Colori UI')}
                <Sparkles className="w-3.5 h-3.5 text-brand-500" />
              </h3>
              <p className="text-[11px] text-slate-500">
                {t('theme.subtitle', "Scegli il colore di base dell'applicazione")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Shade Preview */}
        <div className="mb-5 p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              {t('theme.preview', 'Anteprima Sfumature')}
            </span>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 shadow-2xs">
              {activeTheme.toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-10 gap-1 rounded-lg overflow-hidden p-1 bg-white border border-slate-200 shadow-2xs">
            {shadeKeys.map((key) => {
              const hex = rgbToHex(previewShades[key])
              const isBase = key === 600
              return (
                <div key={key} className="flex flex-col items-center">
                  <div
                    className={`w-full h-8 sm:h-9 rounded-sm transition-all ${
                      isBase ? 'ring-2 ring-slate-900 ring-offset-1 scale-105 z-10' : ''
                    }`}
                    style={{ backgroundColor: hex }}
                    title={`${key}: ${hex}`}
                  />
                  <span className={`text-[9px] mt-1 font-mono ${isBase ? 'font-bold text-slate-900' : 'text-slate-400'}`}>
                    {key}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Preset Palettes */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            {t('theme.presets', 'Palette Predefinite')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {THEME_PRESETS.map((preset) => {
              const isSelected = activeTheme.toLowerCase() === preset.hex.toLowerCase()
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectTheme(preset.hex)}
                  className={`flex items-center space-x-2.5 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-lg flex-shrink-0 shadow-xs flex items-center justify-center text-white"
                    style={{ backgroundColor: preset.hex }}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>
                  <span className={`text-xs truncate ${isSelected ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                    {t(preset.nameKey, preset.id)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Custom Base Color */}
        <div className="mb-6 pt-4 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            {t('theme.custom_color', 'Colore Personalizzato')}
          </label>
          <p className="text-[11px] text-slate-500 mb-2.5">
            {t(
              'theme.custom_color_hint',
              "Scegli qualsiasi colore e l'interfaccia adatterà automaticamente tutte le sue sfumature."
            )}
          </p>

          <div className="flex items-center space-x-2.5">
            {/* HTML5 Native Color Picker */}
            <div className="relative flex-shrink-0">
              <input
                type="color"
                value={activeTheme}
                onChange={(e) => handleSelectTheme(e.target.value)}
                className="w-10 h-10 p-0.5 rounded-xl border border-slate-300 cursor-pointer bg-white shadow-2xs hover:scale-105 transition-transform"
                title="Seleziona colore"
              />
            </div>

            {/* Hex Text Input */}
            <div className="flex-1">
              <input
                type="text"
                value={customHex}
                onChange={handleCustomHexChange}
                placeholder={t('theme.hex_placeholder', 'es. #2563eb')}
                className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm font-mono border focus:outline-none transition-all ${
                  hexInputError
                    ? 'border-rose-400 focus:ring-1 focus:ring-rose-400 bg-rose-50/30'
                    : 'border-slate-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
                }`}
              />
              {hexInputError && <p className="text-[10px] text-rose-500 mt-1">{hexInputError}</p>}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleResetDefault}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('theme.reset_default', 'Reimposta Predefinito')}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            {t('common.close', 'Chiudi')}
          </button>
        </div>
      </div>
    </div>
  )
}
