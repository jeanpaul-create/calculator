/**
 * Layout for the (present) route group — customer-facing meeting mode.
 *
 * The whole point of this group is to OPT OUT of the (app) route group's
 * rep app shell (sidebar, page header, breadcrumb chrome). The root layout
 * still wraps everything; (present) just adds customer-mode body styling.
 *
 * Per DESIGN.md customer-mode rules:
 *   - Body background: gray-50 (page canvas, same as rep mode)
 *   - No sidebar, no rep nav, no breadcrumb
 *   - Page renders its own top + bottom chrome
 */

export const metadata = {
  title: 'Démo client',
}

export default function PresentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="min-h-screen bg-gray-50">{children}</div>
}
