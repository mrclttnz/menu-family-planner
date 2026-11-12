import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, setToken } from '../api'
import { Household } from '../types'
import { Utensils, AlertCircle } from 'lucide-react'

interface AuthModalProps {
  onSuccess: (household: Household) => void
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const { t } = useTranslation()
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
        setError(t('auth.error_default'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 items-center justify-center text-white shadow-md mb-3">
            <Utensils className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">{t('auth.welcome_title')}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {isRegister
              ? t('auth.register_subtitle')
              : t('auth.login_subtitle')}
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
                {t('auth.family_name')}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('auth.family_name_placeholder')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {t('auth.email')}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.email_placeholder')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {t('auth.password')}
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.password_placeholder')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium rounded-xl shadow-sm transition-all text-sm mt-2"
          >
            {loading ? t('auth.btn_processing') : isRegister ? t('auth.btn_register') : t('auth.btn_login')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
          {isRegister ? (
            <p>
              {t('auth.already_account')}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false)
                  setError(null)
                }}
                className="text-brand-600 font-semibold hover:underline"
              >
                {t('auth.link_login')}
              </button>
            </p>
          ) : (
            <p>
              {t('auth.no_account')}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true)
                  setError(null)
                }}
                className="text-brand-600 font-semibold hover:underline"
              >
                {t('auth.link_register')}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
