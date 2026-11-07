import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Palette, RotateCcw, X } from 'lucide-react'

export const DEFAULT_TAG_COLOR = '#16a34a'

export const PRESET_TAG_COLORS = [
  { name: 'UI Green (Default)', hex: '#16a34a' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Sky Blue', hex: '#0284c7' },
  { name: 'Royal Blue', hex: '#2563eb' },
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Pink', hex: '#db2777' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Slate Gray', hex: '#4b5563' },
]

interface TagColorPickerProps {
  isOpen: boolean
  initialColor?: string
  tagName?: string
  onClose: () => void
  onSelectColor: (hexColor: string) => void
}

export const TagColorPicker: React.FC<TagColorPickerProps> = ({
  isOpen,
  initialColor = DEFAULT_TAG_COLOR,
  tagName,
  onClose,
  onSelectColor,
}) => {
  const { t } = useTranslation()
  const [selectedColor, setSelectedColor] = useState<string>(initialColor || DEFAULT_TAG_COLOR)
  const [hexInput, setHexInput] = useState<string>(initialColor || DEFAULT_TAG_COLOR)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handlePresetSelect = (hex: string) => {
    setSelectedColor(hex)
    setHexInput(hex)
    setError(null)
  }

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.trim()
    if (!val.startsWith('#')) {
      val = '#' + val
    }
    setHexInput(val)
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) {
      setSelectedColor(val)
      setError(null)
    } else {
      setError(t('tags.invalid_hex', 'Codice HEX non valido (es. #16a34a)'))
    }
  }

  const handleNativePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSelectedColor(val)
    setHexInput(val)
    setError(null)
  }

  const handleApply = () => {
    if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hexInput)) {
      setError(t('tags.invalid_hex', 'Codice HEX non valido (es. #16a34a)'))
      return
    }
    onSelectColor(selectedColor)
    onClose()
  }

  const handleResetDefault = () => {
    handlePresetSelect(DEFAULT_TAG_COLOR)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Palette className="w-4 h-4 text-brand-600" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              {tagName ? t('tags.color_for_tag', { tag: tagName }) : t('tags.select_color')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Live Preview */}
          <div className="flex items-center space-x-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
            <div
              className="w-10 h-10 rounded-lg shadow-2xs border border-white/60 flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: selectedColor }}
            >
              <Check className="w-5 h-5 text-white drop-shadow-xs" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                {t('tags.preview')}
              </span>
              <span
                className="inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white shadow-2xs truncate"
                style={{ backgroundColor: selectedColor }}
              >
                {tagName || 'Tag Preview'}
              </span>
            </div>
          </div>

          {/* Preset Swatches */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 block mb-1.5">
              {t('tags.preset_colors')}
            </label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_TAG_COLORS.map((preset) => {
                const isSelected = selectedColor.toLowerCase() === preset.hex.toLowerCase()
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => handlePresetSelect(preset.hex)}
                    title={preset.name}
                    className={`h-7 w-full rounded-md shadow-2xs transition-all relative flex items-center justify-center cursor-pointer ${
                      isSelected ? 'ring-2 ring-brand-500 ring-offset-1 scale-105' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: preset.hex }}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow-xs" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Custom Hex Code & Slider / Matrix Dialog */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <label className="text-[11px] font-semibold text-slate-700 block">
              {t('tags.custom_color_or_matrix')}
            </label>
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={hexInput}
                  onChange={handleHexChange}
                  maxLength={7}
                  placeholder="#16a34a"
                  className={`w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border focus:outline-hidden ${
                    error
                      ? 'border-red-400 focus:ring-1 focus:ring-red-500'
                      : 'border-slate-300 focus:ring-1 focus:ring-brand-500'
                  }`}
                />
              </div>

              {/* Native Matrix & Sliders Input trigger */}
              <label
                title={t('tags.open_matrix_sliders')}
                className="relative inline-flex items-center justify-center px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition-colors shadow-2xs space-x-1"
              >
                <Palette className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-[11px]">{t('tags.matrix_picker')}</span>
                <input
                  type="color"
                  value={selectedColor.startsWith('#') && selectedColor.length === 7 ? selectedColor : '#16a34a'}
                  onChange={handleNativePickerChange}
                  className="sr-only"
                />
              </label>
            </div>
            {error && <p className="text-[11px] text-red-500">{error}</p>}
          </div>

          {/* Reset to UI Default */}
          <div className="flex justify-start">
            <button
              type="button"
              onClick={handleResetDefault}
              className="inline-flex items-center space-x-1 text-[11px] text-slate-500 hover:text-brand-600 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('tags.reset_to_default')}</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-3.5 py-1.5 text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            {t('common.apply')}
          </button>
        </div>
      </div>
    </div>
  )
}
