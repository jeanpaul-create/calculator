'use client'

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

  return (
    <SessionProvider session={session}>
      <LanguageProvider>
        <div className="flex h-screen bg-gray-50 overflow-hidden">
          <Sidebar userName={session?.user?.name ?? session?.user?.email ?? ''} role={role} />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </LanguageProvider>
    </SessionProvider>
  )
}
