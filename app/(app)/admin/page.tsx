import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function AdminIndexPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/calculator')
  }
  redirect('/admin/catalog')
}
