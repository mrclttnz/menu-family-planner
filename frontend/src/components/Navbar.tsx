import React from 'react'
import { Utensils, Calendar, BookOpen, Users, LogOut, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Household } from '../types'

interface NavbarProps {
  household: Household | null
  activeTab: 'today' | 'calendar' | 'dishes' | 'members'
  onSelectTab: (tab: 'today' | 'calendar' | 'dishes' | 'members') => void
  onLogout: () => void
}

export const Navbar: React.FC<NavbarProps> = ({
  household,
  activeTab,
  onSelectTab,
  onLogout,
}) => {
  const { t, i18n } = useTranslation()
  const currentLang = i18n.language && i18n.language.startsWith('en') ? 'en' : 'it'

  const handleToggleLanguage = () => {
    const nextLang = currentLang === 'it' ? 'en' : 'it'
    i18n.changeLanguage(nextLang)
    localStorage.setItem('menu_design_language', nextLang)
  }

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-full xl:max-w-[1550px] mx-auto px-2 sm:px-3">
        <div className="flex items-center justify-between h-9">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-1.5 cursor-pointer" onClick={() => onSelectTab('today')}>
            <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center text-white shadow-2xs">
              <Utensils className="w-3 h-3" />
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-xs sm:text-sm text-slate-900 tracking-tight">{t('nav.brand')}</span>
              {household && (
                <span className="hidden sm:inline-block text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                  {household.name}
                </span>
              )}
            </div>
          </div>

          {/* Navigation Tabs (Desktop) */}
          <nav className="hidden md:flex space-x-0.5">
            <button
              onClick={() => onSelectTab('today')}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                activeTab === 'today'
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>{t('nav.today')}</span>
            </button>

            <button
              onClick={() => onSelectTab('calendar')}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                activeTab === 'calendar'
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{t('nav.calendar')}</span>
            </button>

            <button
              onClick={() => onSelectTab('dishes')}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                activeTab === 'dishes'
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{t('nav.dishes')}</span>
            </button>

            <button
              onClick={() => onSelectTab('members')}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                activeTab === 'members'
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{t('nav.members')}</span>
            </button>
          </nav>

          {/* Actions: Language & Logout */}
          <div className="flex items-center space-x-1.5">
            {/* Language Switcher */}
            <button
              onClick={handleToggleLanguage}
              className="flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-semibold border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
              title={currentLang === 'it' ? 'Passa alla lingua inglese (Switch to English)' : 'Switch to Italian (Passa all\'italiano)'}
            >
              <Globe className="w-3 h-3 text-slate-500" />
              <span>{currentLang === 'it' ? 'EN' : 'IT'}</span>
            </button>

            <button
              onClick={onLogout}
              className="flex items-center space-x-1 text-slate-500 hover:text-rose-600 px-2 py-0.5 rounded text-xs font-medium hover:bg-rose-50 transition-colors"
              title={t('nav.logout_title')}
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden sm:inline">{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-4 py-1.5 flex justify-around items-center">
        <button
          onClick={() => onSelectTab('today')}
          className={`flex flex-col items-center py-0.5 px-3 rounded text-[10px] font-medium ${
            activeTab === 'today' ? 'text-brand-600 font-bold' : 'text-slate-500'
          }`}
        >
          <Utensils className="w-4 h-4 mb-0.5" />
          <span>{t('nav.today_short')}</span>
        </button>

        <button
          onClick={() => onSelectTab('calendar')}
          className={`flex flex-col items-center py-0.5 px-3 rounded text-[10px] font-medium ${
            activeTab === 'calendar' ? 'text-brand-600 font-bold' : 'text-slate-500'
          }`}
        >
          <Calendar className="w-4 h-4 mb-0.5" />
          <span>{t('nav.calendar_short')}</span>
        </button>

        <button
          onClick={() => onSelectTab('dishes')}
          className={`flex flex-col items-center py-0.5 px-3 rounded text-[10px] font-medium ${
            activeTab === 'dishes' ? 'text-brand-600 font-bold' : 'text-slate-500'
          }`}
        >
          <BookOpen className="w-4 h-4 mb-0.5" />
          <span>{t('nav.dishes_short')}</span>
        </button>

        <button
          onClick={() => onSelectTab('members')}
          className={`flex flex-col items-center py-0.5 px-3 rounded text-[10px] font-medium ${
            activeTab === 'members' ? 'text-brand-600 font-bold' : 'text-slate-500'
          }`}
        >
          <Users className="w-4 h-4 mb-0.5" />
          <span>{t('nav.members_short')}</span>
        </button>
      </div>
    </header>
  )
}
