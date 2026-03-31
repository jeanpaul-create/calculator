'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useLanguage } from '@/context/LanguageContext'

interface SidebarProps {
  userName?: string
  role: 'REP' | 'ADMIN'
  /** Mobile drawer open state */
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export default function Sidebar({ userName, role, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const { lang, setLang, t } = useLanguage()

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar:
          - Mobile (<768px): hidden by default, slides in as drawer when mobileOpen
          - Tablet (768-1023px): 48px wide, icons only
          - Desktop (≥1024px): 224px wide, icons + labels
      */}
      <aside
        className={[
          'flex flex-col h-full bg-gray-800 flex-shrink-0 z-30',
          // On mobile: fixed drawer that slides in
          'fixed md:relative',
          'transition-transform duration-200 md:transition-none',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          // Width: narrow at tablet, full at desktop
          'w-56 md:w-12 lg:w-56',
        ].join(' ')}
      >
        {/* Logo */}
        <div className="flex items-center px-4 py-5 border-b border-gray-700 md:px-2 md:py-4 md:justify-center lg:px-4 lg:py-5 lg:justify-start">
          {/* Full logo — shown on mobile drawer and desktop */}
          <Image
            src="/logo.png"
            alt="I.ON Energy"
            width={120}
            height={36}
            style={{ objectFit: 'contain' }}
            className="md:hidden lg:block"
          />
          {/* Icon mark — shown on tablet only */}
          <div className="hidden md:flex lg:hidden w-7 h-7 bg-red-500 rounded items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">i</span>
          </div>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto md:px-1 lg:px-2">
          <NavItem href="/calculator" isActive={pathname === '/calculator'} onClick={onMobileClose} title={t('nav_calculator')}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 13h.01M13 13h.01M17 13h.01M17 17h.01M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
            </svg>
            <span className="md:hidden lg:inline">{t('nav_calculator')}</span>
          </NavItem>

          <NavItem href="/calculator/pac" isActive={pathname === '/calculator/pac' || pathname.startsWith('/calculator/pac')} onClick={onMobileClose} title="Calculateur PAC">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
            </svg>
            <span className="md:hidden lg:inline">Calculateur PAC</span>
          </NavItem>

          <NavItem href="/quotes" isActive={isActive('/quotes')} onClick={onMobileClose} title={t('nav_quotes')}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="md:hidden lg:inline">{t('nav_quotes')}</span>
          </NavItem>

          {role === 'ADMIN' && (
            <>
              <div className="pt-4 pb-1 px-3 md:hidden lg:block">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {t('nav_admin')}
                </span>
              </div>
              <div className="hidden md:block lg:hidden pt-3 pb-1 border-t border-gray-700 mx-1" />

              <NavItem href="/admin/catalog" isActive={isActive('/admin/catalog')} onClick={onMobileClose} title={t('nav_catalog')}>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span className="md:hidden lg:inline">{t('nav_catalog')}</span>
              </NavItem>

              <NavItem href="/admin/settings" isActive={isActive('/admin/settings')} onClick={onMobileClose} title={t('nav_settings')}>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="md:hidden lg:inline">{t('nav_settings')}</span>
              </NavItem>
            </>
          )}
        </nav>

        {/* User + language section */}
        <div className="px-2 py-3 border-t border-gray-700 md:px-1 lg:px-2">
          {/* Language toggle — hidden in tablet icon-only mode */}
          <div className="flex items-center gap-1 px-3 py-2 mb-1 md:hidden lg:flex">
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

          <div className="flex items-center gap-2 px-3 py-2 mb-1 md:justify-center md:px-1 lg:justify-start lg:px-3">
            <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-gray-200">
                {userName?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0 md:hidden lg:block">
              <div className="text-sm font-medium text-gray-200 truncate">{userName}</div>
              <div className="text-xs text-gray-500">
                {role === 'ADMIN' ? t('role_admin') : t('role_rep')}
              </div>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            title={t('nav_logout')}
            className="nav-item w-full text-left md:justify-center lg:justify-start"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="md:hidden lg:inline">{t('nav_logout')}</span>
          </button>
        </div>
      </aside>
    </>
  )
}

function NavItem({
  href,
  isActive,
  onClick,
  title,
  children,
}: {
  href: string
  isActive: boolean
  onClick?: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={title}
      className={isActive ? 'nav-item-active' : 'nav-item'}
    >
      {children}
    </Link>
  )
}
