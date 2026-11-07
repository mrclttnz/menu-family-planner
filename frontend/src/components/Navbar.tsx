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
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 pt-[env(safe-area-inset-top,0px)] shadow-2xs">
      <div className="max-w-full xl:max-w-[1550px] mx-auto px-2 sm:px-3">
        {/* Main Header Row */}
        <div className="flex items-center justify-between min-h-[42px] sm:min-h-[46px] py-1">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-1.5 cursor-pointer select-none" onClick={() => onSelectTab('today')}>
            <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center text-white shadow-2xs flex-shrink-0">
              <Utensils className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-xs sm:text-sm text-slate-900 tracking-tight">{t('nav.brand')}</span>
              {household && (
                <span className="hidden sm:inline-block text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 truncate max-w-[120px]">
                  {household.name}
                </span>
              )}
            </div>
          </div>

          {/* Navigation Tabs (Desktop md and above) */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => onSelectTab('today')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'today'
                  ? 'bg-brand-50 text-brand-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Utensils className="w-3.5 h-3.5 text-brand-600" />
              <span>{t('nav.today')}</span>
            </button>

            <button
              onClick={() => onSelectTab('calendar')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-brand-50 text-brand-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-brand-600" />
              <span>{t('nav.calendar')}</span>
            </button>

            <button
              onClick={() => onSelectTab('dishes')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'dishes'
                  ? 'bg-brand-50 text-brand-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-brand-600" />
              <span>{t('nav.dishes')}</span>
            </button>

            <button
              onClick={() => onSelectTab('members')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'members'
                  ? 'bg-brand-50 text-brand-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-brand-600" />
              <span>{t('nav.members')}</span>
            </button>
          </nav>

          {/* Actions: Language & Logout */}
          <div className="flex items-center space-x-1.5">
            {/* Language Switcher Dropdown */}
            <div className="relative" ref={langMenuRef}>
              <button
                type="button"
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="flex items-center space-x-1 px-2 py-1 rounded text-xs font-semibold border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
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
              className="flex items-center space-x-1 text-slate-500 hover:text-rose-600 px-2 py-1 rounded text-xs font-medium hover:bg-rose-50 transition-colors cursor-pointer"
              title={t('nav.logout_title')}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('nav.logout')}</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Tabs (Row 2 on < md screens: full width, clean, never truncated) */}
        <nav className="md:hidden flex items-center justify-around border-t border-slate-100 py-1 px-0.5 gap-1">
          <button
            onClick={() => onSelectTab('today')}
            className={`flex-1 flex items-center justify-center space-x-1 py-1.5 px-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'today'
                ? 'bg-brand-50 text-brand-700 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Utensils className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{t('nav.today')}</span>
          </button>

          <button
            onClick={() => onSelectTab('calendar')}
            className={`flex-1 flex items-center justify-center space-x-1 py-1.5 px-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'calendar'
                ? 'bg-brand-50 text-brand-700 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{t('nav.calendar')}</span>
          </button>

          <button
            onClick={() => onSelectTab('dishes')}
            className={`flex-1 flex items-center justify-center space-x-1 py-1.5 px-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'dishes'
                ? 'bg-brand-50 text-brand-700 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{t('nav.dishes')}</span>
          </button>

          <button
            onClick={() => onSelectTab('members')}
            className={`flex-1 flex items-center justify-center space-x-1 py-1.5 px-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'members'
                ? 'bg-brand-50 text-brand-700 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{t('nav.members')}</span>
          </button>
        </nav>
      </div>
    </header>
  )
}
