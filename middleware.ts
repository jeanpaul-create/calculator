import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'


export default withAuth(
  function middleware(_req) {
    // Auth is verified by the `authorized` callback below.
    // Role-based access (admin routes) is enforced server-side in each page.
    return NextResponse.next()
  },
  {
    callbacks: {
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
