import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const { pathname } = req.nextUrl

    // Admin-only routes
    if (pathname.startsWith('/admin')) {
      if (token?.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/calculator', req.url))
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      // Allow the middleware to run — actual auth check is above
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  // Protect everything except public routes
  matcher: [
    '/calculator/:path*',
    '/quotes/:path*',
    '/admin/:path*',
    '/api/quotes/:path*',
    '/api/catalog/:path*',
    '/api/settings/:path*',
  ],
}
