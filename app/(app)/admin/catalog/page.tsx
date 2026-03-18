import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import CatalogManager from '@/components/admin/CatalogManager'

export const metadata = { title: 'Catalogue' }

export default async function AdminCatalogPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/calculator')
  }

  const [products, costOptions] = await Promise.all([
    prisma.product.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
    prisma.costOption.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
  ])

  return <CatalogManager products={products} costOptions={costOptions} />
}
