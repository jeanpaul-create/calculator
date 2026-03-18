'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatChf } from '@/lib/pricing'

type Category = 'PANEL' | 'INVERTER' | 'BATTERY' | 'MOUNTING' | 'ACCESSORY' | 'EV_CHARGER'

interface Product {
  id: string
  name: string
  description: string | null
  category: Category
  costRappen: number
  powerWp: number | null
  active: boolean
}

interface CostOption {
  id: string
  name: string
  description: string | null
  costRappen: number
  sortOrder: number
  active: boolean
}

interface CatalogManagerProps {
  products: Product[]
  costOptions: CostOption[]
}

const CATEGORY_LABELS: Record<Category, string> = {
  PANEL: 'Panneaux',
  INVERTER: 'Onduleurs',
  BATTERY: 'Batteries',
  MOUNTING: 'Montage',
  ACCESSORY: 'Accessoires',
  EV_CHARGER: 'Borne VE',
}

const CATEGORIES: Category[] = ['PANEL', 'INVERTER', 'BATTERY', 'MOUNTING', 'ACCESSORY', 'EV_CHARGER']

// ─── Product Row ──────────────────────────────────────────────────────────────

function ProductRow({
  product,
  onRefresh,
}: {
  product: Product
  onRefresh: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(product.name)
  const [description, setDescription] = useState(product.description ?? '')
  const [category, setCategory] = useState<Category>(product.category)
  const [costChf, setCostChf] = useState((product.costRappen / 100).toFixed(2))
  const [powerWp, setPowerWp] = useState(product.powerWp?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const patch = async (data: object) => {
    const res = await fetch(`/api/catalog/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error ?? 'Erreur')
    }
    onRefresh()
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await patch({
        name,
        description: description || undefined,
        category,
        costRappen: Math.round(parseFloat(costChf) * 100),
        powerWp: powerWp ? parseInt(powerWp) : null,
      })
      setEditing(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async () => {
    setSaving(true)
    try {
      await patch({ active: !product.active })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await fetch(`/api/catalog/products/${product.id}`, { method: 'DELETE' })
      onRefresh()
    } catch {
      setError('Erreur lors de la suppression')
    } finally {
      setSaving(false)
      setConfirmDelete(false)
    }
  }

  if (editing) {
    return (
      <tr className="bg-yellow-50">
        <td colSpan={6} className="px-4 py-3">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">Nom</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Catégorie</label>
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Coût (CHF HT)</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={costChf}
                  onChange={(e) => setCostChf(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Puissance (Wp/Wh)</label>
                <input
                  className="input"
                  type="number"
                  value={powerWp}
                  onChange={(e) => setPowerWp(e.target.value)}
                  placeholder="—"
                />
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
              {saving ? '…' : 'Enregistrer'}
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary text-xs px-3 py-1.5">
              Annuler
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={!product.active ? 'opacity-50' : undefined}>
      <td>
        <div className="font-medium text-sm">{product.name}</div>
        {product.description && (
          <div className="text-xs text-gray-400 mt-0.5">{product.description}</div>
        )}
      </td>
      <td className="text-sm">{CATEGORY_LABELS[product.category]}</td>
      <td className="tabular-nums text-sm text-gray-600">
        {product.powerWp ? (
          product.powerWp >= 1000
            ? `${(product.powerWp / 1000).toFixed(1)} kW`
            : `${product.powerWp} Wp`
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="text-right tabular-nums font-mono text-sm">{formatChf(product.costRappen)}</td>
      <td>
        <span className={product.active ? 'badge-green' : 'badge-gray'}>
          {product.active ? 'Actif' : 'Inactif'}
        </span>
      </td>
      <td>
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline px-1">
            Modifier
          </button>
          <button
            onClick={handleToggleActive}
            disabled={saving}
            className="text-xs text-gray-500 hover:underline px-1"
          >
            {product.active ? 'Désactiver' : 'Activer'}
          </button>
          {confirmDelete ? (
            <>
              <button onClick={handleDelete} disabled={saving} className="text-xs text-red-600 hover:underline px-1 font-medium">
                Confirmer
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 hover:underline px-1">
                ×
              </button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-400 hover:underline px-1">
              Supprimer
            </button>
          )}
          {error && <span className="text-xs text-red-500 ml-1">{error}</span>}
        </div>
      </td>
    </tr>
  )
}

// ─── Option Row ────────────────────────────────────────────────────────────────

function OptionRow({ option, onRefresh }: { option: CostOption; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(option.name)
  const [description, setDescription] = useState(option.description ?? '')
  const [costChf, setCostChf] = useState((option.costRappen / 100).toFixed(2))
  const [sortOrder, setSortOrder] = useState(option.sortOrder.toString())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const patch = async (data: object) => {
    const res = await fetch(`/api/catalog/options/${option.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error ?? 'Erreur')
    }
    onRefresh()
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await patch({
        name,
        description: description || undefined,
        costRappen: Math.round(parseFloat(costChf) * 100),
        sortOrder: parseInt(sortOrder) || 0,
      })
      setEditing(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async () => {
    setSaving(true)
    try {
      await patch({ active: !option.active })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await fetch(`/api/catalog/options/${option.id}`, { method: 'DELETE' })
      onRefresh()
    } finally {
      setSaving(false)
      setConfirmDelete(false)
    }
  }

  if (editing) {
    return (
      <tr className="bg-yellow-50">
        <td colSpan={4} className="px-4 py-3">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">Nom</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Coût (CHF HT)</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={costChf}
                  onChange={(e) => setCostChf(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Ordre</label>
                <input
                  className="input"
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                />
              </div>
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
              {saving ? '…' : 'Enregistrer'}
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary text-xs px-3 py-1.5">
              Annuler
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={!option.active ? 'opacity-50' : undefined}>
      <td>
        <div className="font-medium text-sm">{option.name}</div>
        {option.description && (
          <div className="text-xs text-gray-400 mt-0.5">{option.description}</div>
        )}
      </td>
      <td className="text-right tabular-nums font-mono text-sm">{formatChf(option.costRappen)}</td>
      <td>
        <span className={option.active ? 'badge-green' : 'badge-gray'}>
          {option.active ? 'Actif' : 'Inactif'}
        </span>
      </td>
      <td>
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline px-1">
            Modifier
          </button>
          <button
            onClick={handleToggleActive}
            disabled={saving}
            className="text-xs text-gray-500 hover:underline px-1"
          >
            {option.active ? 'Désactiver' : 'Activer'}
          </button>
          {confirmDelete ? (
            <>
              <button onClick={handleDelete} disabled={saving} className="text-xs text-red-600 hover:underline px-1 font-medium">
                Confirmer
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 px-1">×</button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-400 hover:underline px-1">
              Supprimer
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Add Product Form ─────────────────────────────────────────────────────────

function AddProductForm({ onRefresh, onCancel }: { onRefresh: () => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<Category>('PANEL')
  const [costChf, setCostChf] = useState('')
  const [powerWp, setPowerWp] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!name || !costChf) {
      setError('Nom et coût requis')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/catalog/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          category,
          costRappen: Math.round(parseFloat(costChf) * 100),
          powerWp: powerWp ? parseInt(powerWp) : undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Erreur')
      }
      onRefresh()
      onCancel()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="bg-blue-50">
      <td colSpan={6} className="px-4 py-3">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="label">Nom *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du produit" />
          </div>
          <div>
            <label className="label">Catégorie *</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Coût (CHF HT) *</label>
              <input className="input" type="number" step="0.01" value={costChf} onChange={(e) => setCostChf(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="label">Puissance (Wp/Wh)</label>
              <input className="input" type="number" value={powerWp} onChange={(e) => setPowerWp(e.target.value)} placeholder="—" />
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <div className="flex gap-2">
          <button onClick={handleSubmit} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
            {saving ? '…' : 'Ajouter'}
          </button>
          <button onClick={onCancel} className="btn-secondary text-xs px-3 py-1.5">Annuler</button>
        </div>
      </td>
    </tr>
  )
}

// ─── Add Option Form ──────────────────────────────────────────────────────────

function AddOptionForm({ onRefresh, onCancel }: { onRefresh: () => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [costChf, setCostChf] = useState('')
  const [sortOrder, setSortOrder] = useState('100')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!name || !costChf) {
      setError('Nom et coût requis')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/catalog/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          costRappen: Math.round(parseFloat(costChf) * 100),
          sortOrder: parseInt(sortOrder) || 100,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Erreur')
      }
      onRefresh()
      onCancel()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="bg-blue-50">
      <td colSpan={4} className="px-4 py-3">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="label">Nom *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du supplément" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Coût (CHF HT) *</label>
              <input className="input" type="number" step="0.01" value={costChf} onChange={(e) => setCostChf(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="label">Ordre</label>
              <input className="input" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </div>
          </div>
          <div className="col-span-2">
            <label className="label">Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <div className="flex gap-2">
          <button onClick={handleSubmit} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
            {saving ? '…' : 'Ajouter'}
          </button>
          <button onClick={onCancel} className="btn-secondary text-xs px-3 py-1.5">Annuler</button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main CatalogManager ──────────────────────────────────────────────────────

export default function CatalogManager({ products: initialProducts, costOptions: initialOptions }: CatalogManagerProps) {
  const router = useRouter()
  const [products, setProducts] = useState(initialProducts)
  const [costOptions, setCostOptions] = useState(initialOptions)
  const [addingProduct, setAddingProduct] = useState(false)
  const [addingOption, setAddingOption] = useState(false)

  const refreshProducts = async () => {
    const res = await fetch('/api/catalog/products?all=1')
    if (res.ok) {
      const data = await res.json()
      setProducts(data)
    } else {
      // Fallback: server refresh
      router.refresh()
    }
  }

  const refreshOptions = async () => {
    const res = await fetch('/api/catalog/options?all=1')
    if (res.ok) {
      const data = await res.json()
      setCostOptions(data)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="p-6 max-w-5xl space-y-8">
      <h1 className="page-title">Catalogue</h1>

      {/* Products */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Produits ({products.length})</h2>
          <button
            onClick={() => setAddingProduct(true)}
            className="btn-primary text-xs px-3 py-1.5"
          >
            + Ajouter un produit
          </button>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Catégorie</th>
                <th>Puissance</th>
                <th className="text-right">Coût (EK)</th>
                <th>Statut</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {addingProduct && (
                <AddProductForm
                  onRefresh={refreshProducts}
                  onCancel={() => setAddingProduct(false)}
                />
              )}
              {products.map((p) => (
                <ProductRow key={p.id} product={p} onRefresh={refreshProducts} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cost options */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Suppléments ({costOptions.length})</h2>
          <button
            onClick={() => setAddingOption(true)}
            className="btn-primary text-xs px-3 py-1.5"
          >
            + Ajouter un supplément
          </button>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Option</th>
                <th className="text-right">Prix</th>
                <th>Statut</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {addingOption && (
                <AddOptionForm
                  onRefresh={refreshOptions}
                  onCancel={() => setAddingOption(false)}
                />
              )}
              {costOptions.map((o) => (
                <OptionRow key={o.id} option={o} onRefresh={refreshOptions} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
