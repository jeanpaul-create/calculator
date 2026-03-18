'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useLanguage } from '@/context/LanguageContext'

interface SidebarProps {
  userName?: string
  role: 'REP' | 'ADMIN'
}

export default function Sidebar({ userName, role }: SidebarProps) {
  const pathname = usePathname()
  const { lang, setLang, t } = useLanguage()

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  return (
    <aside className="w-56 flex-shrink-0 bg-gray-800 flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-gray-700">
        <div className="w-7 h-7 bg-red-500 rounded flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="text-white font-semibold text-sm">I.ON Energy</span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        <Link
          href="/calculator"
          className={isActive('/calculator') ? 'nav-item-active' : 'nav-item'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 13h.01M13 13h.01M17 13h.01M17 17h.01M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
          </svg>
          {t('nav_calculator')}
        </Link>
        <Link
          href="/quotes"
          className={isActive('/quotes') ? 'nav-item-active' : 'nav-item'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {t('nav_quotes')}
        </Link>

        {role === 'ADMIN' && (
          <>
            <div className="pt-4 pb-1 px-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t('nav_admin')}
              </span>
            </div>
            <Link
              href="/admin/catalog"
              className={isActive('/admin/catalog') ? 'nav-item-active' : 'nav-item'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              {t('nav_catalog')}
            </Link>
            <Link
              href="/admin/settings"
              className={isActive('/admin/settings') ? 'nav-item-active' : 'nav-item'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {t('nav_settings')}
            </Link>
          </>
        )}
      </nav>

      {/* User + language section */}
      <div className="px-2 py-3 border-t border-gray-700">
        {/* Language toggle */}
        <div className="flex items-center gap-1 px-3 py-2 mb-1">
          <button
            onClick={() => setLang('fr')}
            className={`flex-1 text-xs rounded py-1 font-medium transition-colors ${
              lang === 'fr'
                ? 'bg-gray-600 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            FR
          </button>
          <button
            onClick={() => setLang('de')}
            className={`flex-1 text-xs rounded py-1 font-medium transition-colors ${
              lang === 'de'
                ? 'bg-gray-600 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            DE
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 mb-1">
          <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-gray-200">
              {userName?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-200 truncate">{userName}</div>
            <div className="text-xs text-gray-500">
              {role === 'ADMIN' ? t('role_admin') : t('role_rep')}
            </div>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="nav-item w-full text-left"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {t('nav_logout')}
        </button>
      </div>
    </aside>
  )
}
