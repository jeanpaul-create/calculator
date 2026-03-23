'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface Suggestion {
  label: string   // raw HTML label from API
  text: string    // plain text version for the input
  lat: number
  lon: number
}

interface AddressSearchProps {
  value: string
  onChange: (value: string) => void
  onSelect: (address: string, lat: number, lon: number, zip?: string) => void
  placeholder?: string
  className?: string
}

// Strip HTML tags from swisstopo label (e.g. "Rue de la Paix 1 <b>1180 Rolle</b>")
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

export default function AddressSearch({
  value,
  onChange,
  onSelect,
  placeholder = 'Rue, Ville',
  className = 'input',
}: AddressSearchProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback(async (query: string) => {
    if (query.length < 4) {
      setSuggestions([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const url = `https://api3.geo.admin.ch/rest/services/ech/SearchServer?type=locations&searchText=${encodeURIComponent(query)}&lang=fr&limit=6`
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
      if (!res.ok) return
      const data = await res.json()
      const results: Suggestion[] = (data.results ?? [])
        .filter((r: any) => r.attrs?.lat && r.attrs?.lon)
        .map((r: any) => ({
          label: r.attrs.label ?? '',
          text: stripHtml(r.attrs.label ?? ''),
          lat: r.attrs.lat,
          lon: r.attrs.lon,
        }))
      setSuggestions(results)
      setOpen(results.length > 0)
    } catch {
      // silently ignore network errors
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  const handleSelect = (s: Suggestion) => {
    onChange(s.text)
    // Extract NPA from the bold part of the swisstopo label, e.g. "<b>1185 Mont-sur-Rolle</b>"
    const boldMatch = s.label.match(/<b>(\d{4})[^<]*<\/b>/)
    const zip = boldMatch?.[1] ?? undefined
    onSelect(s.text, s.lat, s.lon, zip)
    setSuggestions([])
    setOpen(false)
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">…</span>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-52 overflow-y-auto text-sm">
          {suggestions.map((s, i) => (
            <li
              key={i}
              className="px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-0 truncate"
              onMouseDown={(e) => {
                e.preventDefault() // prevent blur before click
                handleSelect(s)
              }}
              dangerouslySetInnerHTML={{ __html: s.label }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
