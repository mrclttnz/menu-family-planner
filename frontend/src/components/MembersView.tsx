import React, { useState } from 'react'
import { Member } from '../types'
import { Users, UserPlus, Trash2, Baby, Smile } from 'lucide-react'

interface MembersViewProps {
  members: Member[]
  onAddMember: (payload: { name: string; avatar_color?: string; is_child?: boolean }) => Promise<void>
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
  onDeleteMember,
}) => {
  const [name, setName] = useState('')
  const [avatarColor, setAvatarColor] = useState(COLOR_PALETTE[0])
  const [isChild, setIsChild] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
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

  return (
    <div className="space-y-6 pb-20 md:pb-8 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
          <Users className="w-5 h-5 text-brand-600" />
          <span>I Membri della Famiglia</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configura i commensali di casa per tracciare presenze e gusti a tavola
        </p>
      </div>

      {/* Add Member Card */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs">
        <h3 className="font-semibold text-slate-800 text-sm mb-4 flex items-center space-x-2">
          <UserPlus className="w-4 h-4 text-brand-600" />
          <span>Aggiungi un Familiare</span>
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Nome del Familiare *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="es. Mamma, Papà, Leo, Giulia"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
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
              className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
            />
            <label htmlFor="isChild" className="text-sm text-slate-700 select-none flex items-center space-x-1">
              <Baby className="w-4 h-4 text-slate-500" />
              <span>È un bambino/ragazzo (utile per segnalare piatti per soli adulti)</span>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-sm transition-all"
            >
              {loading ? 'Aggiunta...' : 'Aggiungi Familiare'}
            </button>
          </div>
        </form>
      </div>

      {/* Members List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
          Tutti i Commensali del Nucleo ({members.length})
        </div>

        {members.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Nessun membro ancora aggiunto.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {members.map((m) => (
              <div key={m.id} className="p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-2xs"
                    style={{ backgroundColor: m.avatar_color || '#3B82F6' }}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm">{m.name}</h4>
                    <div className="flex items-center space-x-2 mt-0.5">
                      {m.is_child ? (
                        <span className="flex items-center space-x-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium border border-amber-200">
                          <Baby className="w-3 h-3" />
                          <span>Bambino</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                          <Smile className="w-3 h-3 text-slate-400" />
                          <span>Adulto</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onDeleteMember(m.id)}
                  className="text-slate-300 hover:text-rose-500 p-2 rounded-lg transition-colors"
                  title="Rimuovi familiare"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
