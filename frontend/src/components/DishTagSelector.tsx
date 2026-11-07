import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, Palette, Tag as TagIcon } from 'lucide-react'
import { TagColorPicker, DEFAULT_TAG_COLOR } from './TagColorPicker'

export interface SelectedTagItem {
  id?: number
  name: string
  color?: string
}

interface DishTagSelectorProps {
  selectedTags: SelectedTagItem[]
  availableTags?: Array<{ id?: number; name: string; color: string }>
  onChange: (tags: SelectedTagItem[]) => void
}

export const DishTagSelector: React.FC<DishTagSelectorProps> = ({
  selectedTags,
  availableTags = [],
  onChange,
}) => {
  const { t } = useTranslation()
  const [inputValue, setInputValue] = useState('')
  const [colorPickerTargetIndex, setColorPickerTargetIndex] = useState<number | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [inputError, setInputError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAddTag = (rawName: string, presetColor?: string) => {
    // Strip any commas and extra spaces
    const cleanName = rawName.replace(/,/g, '').trim()
    if (!cleanName) return

    // Case-insensitive check if tag already in selected
    const alreadySelected = selectedTags.some(
      (t) => t.name.toLowerCase() === cleanName.toLowerCase()
    )
    if (alreadySelected) {
      setInputError(t('tags.already_added', 'Tag già presente'))
      setInputValue('')
      return
    }

    // Check if tag already exists in household available tags
    const existing = availableTags.find(
      (t) => t.name.toLowerCase() === cleanName.toLowerCase()
    )

    const color = presetColor || existing?.color || DEFAULT_TAG_COLOR

    onChange([...selectedTags, { id: existing?.id, name: cleanName, color }])
    setInputValue('')
    setInputError(null)
    setIsDropdownOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      handleAddTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      // Remove last tag on backspace if input empty
      onChange(selectedTags.slice(0, selectedTags.length - 1))
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    // If user types or pastes with a comma, add immediately
    if (val.includes(',')) {
      const parts = val.split(',')
      for (const part of parts) {
        if (part.trim()) {
          handleAddTag(part)
        }
      }
      setInputValue('')
      return
    }
    setInputValue(val)
    setInputError(null)
    setIsDropdownOpen(true)
  }

  const handleRemoveTag = (index: number) => {
    onChange(selectedTags.filter((_, i) => i !== index))
  }

  const handleUpdateTagColor = (index: number, newColor: string) => {
    const updated = [...selectedTags]
    updated[index] = { ...updated[index], color: newColor }
    onChange(updated)
  }

  // Suggestions for autocomplete
  const filteredSuggestions = availableTags.filter((tag) => {
    const matchesQuery =
      !inputValue.trim() || tag.name.toLowerCase().includes(inputValue.toLowerCase())
    const notSelected = !selectedTags.some(
      (s) => s.name.toLowerCase() === tag.name.toLowerCase()
    )
    return matchesQuery && notSelected
  })

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
        <span className="flex items-center space-x-1.5">
          <TagIcon className="w-3.5 h-3.5 text-brand-600" />
          <span>{t('tags.label', 'Tag')}</span>
        </span>
        <span className="text-[10px] text-slate-400 font-normal">
          {t('tags.helper_hint', 'Premi Invio o virgola per aggiungere')}
        </span>
      </label>

      {/* Tags Box */}
      <div className="relative">
        <div className="min-h-10 w-full p-1.5 rounded-lg border border-slate-300 focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 bg-white flex flex-wrap items-center gap-1.5 text-xs transition-all">
          {selectedTags.map((tag, index) => {
            const tagColor = tag.color || DEFAULT_TAG_COLOR
            return (
              <span
                key={`${tag.name}_${index}`}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-white text-[11px] font-medium shadow-2xs group transition-all"
                style={{ backgroundColor: tagColor }}
              >
                <span>{tag.name}</span>

                {/* Edit Color Button */}
                <button
                  type="button"
                  onClick={() => setColorPickerTargetIndex(index)}
                  title={t('tags.change_color', 'Modifica colore')}
                  className="p-0.5 rounded-full hover:bg-black/20 text-white/90 hover:text-white transition-colors cursor-pointer"
                >
                  <Palette className="w-2.5 h-2.5" />
                </button>

                {/* Remove Button */}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(index)}
                  title={t('tags.remove_tag', 'Rimuovi tag')}
                  className="p-0.5 rounded-full hover:bg-black/20 text-white/90 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )
          })}

          {/* Inline Input */}
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsDropdownOpen(true)}
            placeholder={
              selectedTags.length === 0
                ? t('tags.input_placeholder', 'Aggiungi tag (es. Veloce, Invernale, Pesce)...')
                : ''
            }
            className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-xs text-slate-800 placeholder-slate-400 py-1 px-1"
          />
        </div>

        {inputError && (
          <p className="text-[11px] text-red-500 mt-1">{inputError}</p>
        )}

        {/* Existing Tags Box (in-flow so the modal resizes naturally to contain everything) */}
        {isDropdownOpen && filteredSuggestions.length > 0 && (
          <div className="mt-1.5 p-2 bg-slate-50 border border-slate-200/90 rounded-lg space-y-1.5 animate-in fade-in duration-100">
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              <span>{t('tags.existing_tags', 'Tag esistenti')}</span>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-normal lowercase cursor-pointer"
              >
                {t('common.close', 'Chiudi')}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-0.5">
              {filteredSuggestions.map((tag) => (
                <button
                  key={tag.id || tag.name}
                  type="button"
                  onClick={() => handleAddTag(tag.name, tag.color)}
                  className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color || DEFAULT_TAG_COLOR }}
                  />
                  <span>{tag.name}</span>
                  <Plus className="w-3 h-3 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Color Picker Modal */}
      {colorPickerTargetIndex !== null && (
        <TagColorPicker
          isOpen={true}
          initialColor={selectedTags[colorPickerTargetIndex]?.color || DEFAULT_TAG_COLOR}
          tagName={selectedTags[colorPickerTargetIndex]?.name}
          onClose={() => setColorPickerTargetIndex(null)}
          onSelectColor={(newColor) => {
            handleUpdateTagColor(colorPickerTargetIndex, newColor)
            setColorPickerTargetIndex(null)
          }}
        />
      )}
    </div>
  )
}
