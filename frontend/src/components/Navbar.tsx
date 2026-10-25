import React from 'react'
import { Utensils, Calendar, BookOpen, Users, LogOut } from 'lucide-react'
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
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectTab('today')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center text-white shadow-sm">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight">Menu Design</span>
              {household && (
                <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {household.name}
                </span>
              )}
            </div>
          </div>

          {/* Navigation Tabs (Desktop) */}
          <nav className="hidden md:flex space-x-1">
            <button
              onClick={() => onSelectTab('today')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'today'
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Utensils className="w-4 h-4" />
              <span>Oggi a Tavola</span>
            </button>

            <button
              onClick={() => onSelectTab('calendar')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'calendar'
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Piano Pasti</span>
            </button>

            <button
              onClick={() => onSelectTab('dishes')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'dishes'
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Catalogo Ricette</span>
            </button>

            <button
              onClick={() => onSelectTab('members')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'members'
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Famiglia</span>
            </button>
          </nav>

          {/* User & Logout */}
          <div className="flex items-center space-x-2">
            {household ? (
              <button
                onClick={onLogout}
                title="Esci dal profilo famiglia"
                className="flex items-center space-x-1 p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Esci</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 px-2 py-1 flex justify-around">
        <button
          onClick={() => onSelectTab('today')}
          className={`flex flex-col items-center py-1 px-2 rounded text-xs font-medium ${
            activeTab === 'today' ? 'text-brand-600 font-semibold' : 'text-slate-500'
          }`}
        >
          <Utensils className="w-5 h-5 mb-0.5" />
          <span>Oggi</span>
        </button>
        <button
          onClick={() => onSelectTab('calendar')}
          className={`flex flex-col items-center py-1 px-2 rounded text-xs font-medium ${
            activeTab === 'calendar' ? 'text-brand-600 font-semibold' : 'text-slate-500'
          }`}
        >
          <Calendar className="w-5 h-5 mb-0.5" />
          <span>Calendario</span>
        </button>
        <button
          onClick={() => onSelectTab('dishes')}
          className={`flex flex-col items-center py-1 px-2 rounded text-xs font-medium ${
            activeTab === 'dishes' ? 'text-brand-600 font-semibold' : 'text-slate-500'
          }`}
        >
          <BookOpen className="w-5 h-5 mb-0.5" />
          <span>Piatti</span>
        </button>
        <button
          onClick={() => onSelectTab('members')}
          className={`flex flex-col items-center py-1 px-2 rounded text-xs font-medium ${
            activeTab === 'members' ? 'text-brand-600 font-semibold' : 'text-slate-500'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span>Famiglia</span>
        </button>
      </div>
    </header>
  )
}
