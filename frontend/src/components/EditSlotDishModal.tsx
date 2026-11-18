import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Member } from '../types'
import { parseDate } from '../dateUtils'
import { Utensils, Users, X } from 'lucide-react'

export interface EditSlotDishModalProps {
  isOpen: boolean
  onClose: () => void
  slotId: number
  slotDate: string
  mealTypeName: string
  dishId: number
  dishTitle: string
  assignedMemberIds: number[]
  members: Member[]
  onSave: (slotId: number, dishId: number, targetMemberIds: number[]) => Promise<void>
}

export const EditSlotDishModal: React.FC<EditSlotDishModalProps> = ({
  isOpen,
  onClose,
  slotId,
  slotDate,
  mealTypeName,
  dishId,
  dishTitle,
  assignedMemberIds,
  members,
  onSave,
}) => {
  const { t, i18n } = useTranslation()
  const currentLocale = i18n.language && i18n.language.startsWith('en') ? 'en-US' : 'it-IT'

  const [editAssignForSpecific, setEditAssignForSpecific] = useState<boolean>(false)
  const [editSelectedMemberIds, setEditSelectedMemberIds] = useState<number[]>([])
  const [isSaving, setIsSaving] = useState<boolean>(false)

  useEffect(() => {
    if (!isOpen) return
    const isSpecific = assignedMemberIds && assignedMemberIds.length > 0
    setEditAssignForSpecific(isSpecific)
    setEditSelectedMemberIds(
      isSpecific ? [...assignedMemberIds] : members.map((m) => m.id)
    )
  }, [isOpen, assignedMemberIds, members])

  if (!isOpen) return null

  const handleToggleMember = (memberId: number) => {
    if (editSelectedMemberIds.includes(memberId)) {
      setEditSelectedMemberIds(editSelectedMemberIds.filter((id) => id !== memberId))
    } else {
      setEditSelectedMemberIds([...editSelectedMemberIds, memberId])
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const targetMemberIds = editAssignForSpecific ? editSelectedMemberIds : []
      await onSave(slotId, dishId, targetMemberIds)
      onClose()
    } catch (err) {
      console.error('Failed to update dish assignment:', err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => !isSaving && onClose()}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-4 space-y-4 border border-slate-200 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center space-x-2">
            <Utensils className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-semibold text-slate-800">
              {t('calendar.edit_dish_assignment_title')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dish & Slot Info */}
        <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200/80 space-y-1">
          <div className="text-xs font-semibold text-slate-900">
            {dishTitle}
          </div>
          <div className="text-[11px] text-slate-500">
            {new Intl.DateTimeFormat(currentLocale, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            }).format(parseDate(slotDate))} • {mealTypeName}
          </div>
        </div>

        {/* Diners Assignment Section */}
        <div className="space-y-2 border border-slate-200/80 rounded-md p-3 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700 flex items-center space-x-1.5">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>{t('calendar.dish_diners_label')}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                const nextSpecific = !editAssignForSpecific
                setEditAssignForSpecific(nextSpecific)
                if (nextSpecific) {
                  setEditSelectedMemberIds(
                    assignedMemberIds.length > 0
                      ? [...assignedMemberIds]
                      : members.map((m) => m.id)
                  )
                } else {
                  setEditSelectedMemberIds([])
                }
              }}
              className="text-[11px] font-medium text-brand-600 hover:text-brand-700 underline cursor-pointer"
            >
              {editAssignForSpecific ? t('calendar.assign_all_diners') : t('calendar.alternative_dish_help')}
            </button>
          </div>

          {editAssignForSpecific ? (
            <div className="space-y-2 pt-1">
              <span className="text-[11px] text-slate-500 block">
                {t('calendar.select_diners')}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const isSelected = editSelectedMemberIds.includes(m.id)
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => handleToggleMember(m.id)}
                      className={`flex items-center space-x-1.5 px-2 py-1 rounded-full text-xs transition-all border cursor-pointer ${
                        isSelected
                          ? 'bg-brand-50 text-brand-800 border-brand-300 font-semibold shadow-xs'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: m.avatar_color || '#3B82F6' }}
                      />
                      <span>{m.name}</span>
                    </button>
                  )
                })}
              </div>
              {editSelectedMemberIds.length === 0 && (
                <p className="text-[11px] text-rose-500 italic">
                  {t('calendar.select_at_least_one_diner')}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 italic pt-0.5">
              {t('calendar.assigned_to_all_diners')}
            </p>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || (editAssignForSpecific && editSelectedMemberIds.length === 0)}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors shadow-2xs cursor-pointer"
          >
            {isSaving ? '...' : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
