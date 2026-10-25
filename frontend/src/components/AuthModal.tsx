import React, { useState } from 'react'
import { api, setToken } from '../api'
import { Household } from '../types'
import { Utensils, AlertCircle } from 'lucide-react'

interface AuthModalProps {
  onSuccess: (household: Household) => void
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('Famiglia Rossi')
  const [email, setEmail] = useState('famiglia.rossi@example.com')
  const [password, setPassword] = useState('Password123!')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isRegister) {
        const res = await api.register({ name, email, password })
        setToken(res.access_token)
        onSuccess(res.household)
      } else {
        const res = await api.login({ email, password })
        setToken(res.access_token)
        onSuccess(res.household)
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Si è verificato un errore durante l’accesso.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 items-center justify-center text-white shadow-md mb-3">
            <Utensils className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Benvenuto su Menu Design</h2>
          <p className="text-sm text-slate-500 mt-1">
            {isRegister
              ? 'Crea lo spazio per la tua famiglia'
              : 'Accedi allo spazio del tuo nucleo familiare'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Nome Famiglia
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="es. Famiglia Rossi"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Email Nucleo Familiare
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="famiglia@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimo 8 caratteri"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium rounded-xl shadow-sm transition-all text-sm mt-2"
          >
            {loading ? 'Elaborazione in corso...' : isRegister ? 'Crea Spazio Famiglia' : 'Accedi'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
          {isRegister ? (
            <p>
              Hai già un account?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false)
                  setError(null)
                }}
                className="text-brand-600 font-semibold hover:underline"
              >
                Accedi
              </button>
            </p>
          ) : (
            <p>
              Non hai ancora uno spazio famiglia?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true)
                  setError(null)
                }}
                className="text-brand-600 font-semibold hover:underline"
              >
                Registrati
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
