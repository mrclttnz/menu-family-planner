import React, { useState } from 'react'
import { Member } from '../types'
import { Users, UserPlus, Trash2, Edit2, Baby, Smile, X } from 'lucide-react'

interface MembersViewProps {
  members: Member[]
  onAddMember: (payload: { name: string; avatar_color?: string; is_child?: boolean }) => Promise<void>
  onUpdateMember: (id: number, payload: { name?: string; avatar_color?: string; is_child?: boolean }) => Promise<void>
  onDeleteMember: (id: number) => Promise<void>
}

const COLOR_PALETTE = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#64748B', // Slate
]

export const MembersView: React.FC<MembersViewProps> = ({
  members,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
}) => {
  // Add State
  const [name, setName] = useState('')
  const [avatarColor, setAvatarColor] = useState(COLOR_PALETTE[0])
  const [isChild, setIsChild] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit State (G001)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [editName, setEditName] = useState('')
  const [editAvatarColor, setEditAvatarColor] = useState(COLOR_PALETTE[0])
  const [editIsChild, setEditIsChild] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await onAddMember({
        name: name.trim(),
        avatar_color: avatarColor,
        is_child: isChild,
      })
      setName('')
      setIsChild(false)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Errore durante la creazione del familiare.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleStartEdit = (m: Member) => {
    setEditingMember(m)
    setEditName(m.name)
    setEditAvatarColor(m.avatar_color || COLOR_PALETTE[0])
    setEditIsChild(m.is_child)
    setEditError(null)
  }

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingMember) return
    setEditError(null)
    setEditLoading(true)
    try {
      await onUpdateMember(editingMember.id, {
        name: editName.trim(),
        avatar_color: editAvatarColor,
        is_child: editIsChild,
      })
      setEditingMember(null)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setEditError(err.message)
      } else {
        setEditError('Errore durante la modifica del familiare.')
      }
    } finally {
      setEditLoading(false)
    }
  }

  return (
    <div className="space-y-4 pb-16 md:pb-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
          <Users className="w-5 h-5 text-brand-600" />
          <span>I Membri della Famiglia</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configura i commensali di casa per tracciare presenze e gusti a tavola
        </p>
      </div>

      {/* Add Member Card */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-2xs">
        <h3 className="font-semibold text-slate-800 text-xs sm:text-sm mb-3 flex items-center space-x-1.5">
          <UserPlus className="w-4 h-4 text-brand-600" />
          <span>Aggiungi un Familiare</span>
        </h3>

        {error && (
          <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleAddSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Nome del Familiare *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="es. Mamma, Papà, Leo, Giulia"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Colore Badge
              </label>
              <div className="flex items-center space-x-2 py-1">
                {COLOR_PALETTE.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setAvatarColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      avatarColor === c ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'opacity-80 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isChild"
              checked={isChild}
              onChange={(e) => setIsChild(e.target.checked)}
              className="w-3.5 h-3.5 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
            />
            <label htmlFor="isChild" className="text-xs text-slate-700 select-none flex items-center space-x-1">
              <Baby className="w-3.5 h-3.5 text-slate-500" />
              <span>È un bambino/ragazzo (utile per segnalare piatti per soli adulti)</span>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-2xs transition-all"
            >
              {loading ? 'Aggiunta...' : 'Aggiungi Familiare'}
            </button>
          </div>
        </form>
      </div>

      {/* Members List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
          Tutti i Commensali del Nucleo ({members.length})
        </div>

        {members.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs sm:text-sm">
            Nessun membro ancora aggiunto.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {members.map((m) => (
              <div key={m.id} className="p-3 sm:px-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-2xs"
                    style={{ backgroundColor: m.avatar_color || '#3B82F6' }}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-xs sm:text-sm">{m.name}</h4>
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      {m.is_child ? (
                        <span className="flex items-center space-x-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium border border-amber-200">
                          <Baby className="w-2.5 h-2.5" />
                          <span>Bambino</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                          <Smile className="w-2.5 h-2.5 text-slate-400" />
                          <span>Adulto</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  {/* G001: Edit Member Button */}
                  <button
                    onClick={() => handleStartEdit(m)}
                    className="text-slate-400 hover:text-brand-600 p-1.5 rounded-lg transition-colors"
                    title="Modifica familiare"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Member Button */}
                  <button
                    onClick={() => onDeleteMember(m.id)}
                    className="text-slate-300 hover:text-rose-500 p-1.5 rounded-lg transition-colors"
                    title="Rimuovi familiare"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Member Modal (G001) */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl p-5 max-w-md w-full space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-brand-600" />
                <span>Modifica Familiare</span>
              </h3>
              <button
                onClick={() => setEditingMember(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-2.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-medium">
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdateSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nome del Familiare *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Colore Badge
                </label>
                <div className="flex items-center space-x-2 py-1">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setEditAvatarColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        editAvatarColor === c ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'opacity-80 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="editIsChild"
                  checked={editIsChild}
                  onChange={(e) => setEditIsChild(e.target.checked)}
                  className="w-3.5 h-3.5 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                />
                <label htmlFor="editIsChild" className="text-xs text-slate-700 select-none flex items-center space-x-1">
                  <Baby className="w-3.5 h-3.5 text-slate-500" />
                  <span>È un bambino/ragazzo</span>
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 shadow-xs"
                >
                  {editLoading ? 'Salvataggio...' : 'Salva Modifiche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
