import { NextAuthOptions, getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  // Credentials provider requires JWT sessions — database sessions are not supported
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours — standard workday
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Email & Passwort',
      credentials: {
        email: { label: 'E-Mail', type: 'email' },
        password: { label: 'Passwort', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            role: true,
          },
        })

        if (!user?.passwordHash) return null

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email ?? '',
          name: user.name ?? '',
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On sign-in, persist id and role into the token
      if (user) {
        token.id = user.id
        token.role = (user as { role: Role }).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
      }
      return session
    },
  },
}

/**
 * Server-side helper: get the current session or null.
 * Use in Server Components and Route Handlers.
 */
export function auth() {
  return getServerSession(authOptions)
}

/**
 * Server-side helper: require an authenticated session.
 * Throws a Response (401) if not authenticated — use in Route Handlers.
 */
export async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new Response('Unauthorized', { status: 401 })
  }
  return session
}

/**
 * Server-side helper: require ADMIN role.
 * Throws a Response (403) if not admin.
 */
export async function requireAdmin() {
  const session = await requireAuth()
  if (session.user.role !== 'ADMIN') {
    throw new Response('Forbidden', { status: 403 })
  }
  return session
}

/**
 * Verify the current user owns a quote, or is an admin.
 * Throws 403 if neither.
 */
export async function requireOwnerOrAdmin(quoteRepId: string) {
  const session = await requireAuth()
  const isOwner = session.user.id === quoteRepId
  const isAdmin = session.user.role === 'ADMIN'
  if (!isOwner && !isAdmin) {
    throw new Response('Forbidden', { status: 403 })
  }
  return session
}
