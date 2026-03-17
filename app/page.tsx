import { redirect } from 'next/navigation'

// Root redirect: authenticated users go to calculator, others to login
export default function RootPage() {
  redirect('/calculator')
}
