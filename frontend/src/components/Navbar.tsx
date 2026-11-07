import React, { useState, useRef, useEffect } from 'react'
import { Utensils, Calendar, BookOpen, Users, LogOut, Globe, ChevronDown, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Household } from '../types'

interface LanguageOption {
  code: string
  label: string
  shortLabel: string
  flag: string
}

const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'it', label: 'Italiano', shortLabel: 'IT', flag: '🇮🇹' },
  { code: 'en', label: 'English', shortLabel: 'EN', flag: '🇬🇧' },
]

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
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false)
  const langMenuRef = useRef<HTMLDivElement>(null)

  const currentLang = i18n.language && i18n.language.startsWith('en') ? 'en' : 'it'
  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang) || SUPPORTED_LANGUAGES[0]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSelectLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode)
    localStorage.setItem('menu_design_language', langCode)
    setIsLangMenuOpen(false)
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
            {/* Language Switcher Dropdown (scalable for N languages, shows active language) */}
            <div className="relative" ref={langMenuRef}>
              <button
                type="button"
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-semibold border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                title={t('nav.select_language')}
              >
                <Globe className="w-3 h-3 text-slate-500" />
                <span className="font-bold">{currentLangObj.shortLabel}</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isLangMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isLangMenuOpen && (
                <div className="absolute right-0 mt-1 w-36 bg-white rounded-md shadow-lg border border-slate-200 py-1 z-50">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {t('nav.language')}
                  </div>
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const isSelected = currentLang === lang.code
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => handleSelectLanguage(lang.code)}
                        className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                          isSelected ? 'text-brand-700 font-bold bg-brand-50/60' : 'text-slate-700 font-medium'
                        }`}
                      >
                        <span className="flex items-center space-x-1.5">
                          <span>{lang.flag}</span>
                          <span>{lang.label}</span>
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-brand-600" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

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
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 pt-1 pb-[max(0.375rem,env(safe-area-inset-bottom))] flex justify-around items-center">
        <button
          onClick={() => onSelectTab('today')}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded text-[10px] font-medium transition-colors ${
            activeTab === 'today' ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Utensils className="w-4 h-4 mb-0.5" />
          <span>{t('nav.today_short')}</span>
        </button>

        <button
          onClick={() => onSelectTab('calendar')}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded text-[10px] font-medium transition-colors ${
            activeTab === 'calendar' ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Calendar className="w-4 h-4 mb-0.5" />
          <span>{t('nav.calendar_short')}</span>
        </button>

        <button
          onClick={() => onSelectTab('dishes')}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded text-[10px] font-medium transition-colors ${
            activeTab === 'dishes' ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <BookOpen className="w-4 h-4 mb-0.5" />
          <span>{t('nav.dishes_short')}</span>
        </button>

        <button
          onClick={() => onSelectTab('members')}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded text-[10px] font-medium transition-colors ${
            activeTab === 'members' ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4 mb-0.5" />
          <span>{t('nav.members_short')}</span>
        </button>
      </div>
    </header>
  )
}
