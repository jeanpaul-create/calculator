'use client'

import { useState } from 'react'
import { SessionProvider } from 'next-auth/react'
import Sidebar from './Sidebar'
import { Session } from 'next-auth'
import { LanguageProvider } from '@/context/LanguageContext'

interface AppShellProps {
  children: React.ReactNode
  session: Session | null
}

export default function AppShell({ children, session }: AppShellProps) {
  const role = (session?.user?.role ?? 'REP') as 'REP' | 'ADMIN'
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <SessionProvider session={session}>
      <LanguageProvider>
        <div className="flex h-screen bg-gray-50 overflow-hidden">
          {/*
            Sidebar:
            - Mobile (<768px): fixed off-screen drawer, slides in when mobileOpen
            - Tablet (768-1023px): 48px wide icon-only, part of flex layout
            - Desktop (≥1024px): 224px wide full labels, part of flex layout
          */}
          <Sidebar
            userName={session?.user?.name ?? session?.user?.email ?? ''}
            role={role}
            mobileOpen={mobileOpen}
            onMobileClose={() => setMobileOpen(false)}
          />

          {/* Main content area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile top bar with hamburger */}
            <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-gray-800 border-b border-gray-700 flex-shrink-0">
              <button
                onClick={() => setMobileOpen(true)}
                className="text-gray-300 hover:text-white p-1 -ml-1"
                aria-label="Ouvrir le menu"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="w-6 h-6 bg-red-500 rounded flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">i</span>
              </div>
              <span className="text-sm font-semibold text-white">I.ON Energy</span>
            </header>

            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      </LanguageProvider>
    </SessionProvider>
  )
}
