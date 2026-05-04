/**
 * SiteMap — Leaflet aerial-view component for both PV and PAC calculators.
 *
 *   Architecture (ASCII):
 *
 *     ┌──────────────────────────────────────────────────────────────────┐
 *     │ MapContainer (with optional Fullscreen wrapper)                   │
 *     │                                                                   │
 *     │  TileLayer (swisstopo SwissImage satellite — base layer)          │
 *     │   │                                                               │
 *     │   ├─ SolarOverlay      (PV mode, toggleable, OFEN suitability)   │
 *     │   │                                                               │
 *     │   ├─ CadastreOverlay   (PAC mode, parcel boundaries)             │
 *     │   │                                                               │
 *     │   ├─ ParcelPolygon     (red, on PAC click — own parcel ring)    │
 *     │   │                                                               │
 *     │   ├─ NeighborPolygon   (blue, nearest neighbor building)         │
 *     │   │                                                               │
 *     │   ├─ DistanceLines     (orange dashed → property edge,           │
 *     │   │                     blue solid → neighbor)                    │
 *     │   │                                                               │
 *     │   ├─ SiteMarker        (red, draggable — always)                 │
 *     │   │                                                               │
 *     │   ├─ PacUnitMarker     (orange divIcon, draggable, PAC only)    │
 *     │   │                                                               │
 *     │   └─ RoofPopup         (PV click → swisstopo Identify)          │
 *     │                                                                   │
 *     └──────────────────────────────────────────────────────────────────┘
 *           │
 *           └─► DistancePanel (below the map: "Limite: X m / Voisin: Y m")
 *
 *   Data flows out via:
 *     - onSiteMarkerMove → parent stores lat/lon for the quote
 *     - onPacUnitMove    → parent stores PAC unit lat/lon for the quote
 *
 *   Data flows in:
 *     - swisstopo /api/swisstopo/roof   on roof click  (PV)
 *     - swisstopo /api/swisstopo/parcel on PAC click   (PAC)
 *     - OSM /api/buildings/nearby       on PAC click   (PAC)
 *
 * NOTE: This file is intentionally large (>800 lines). A future refactor (see
 * TODOS.md "Split SiteMap.tsx into composable layer components") will break
 * each layer above into its own component. Until then, tests via T1
 * (lib/geo) and T4 (swisstopo aggregators) protect the underlying math.
 */
'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  Polyline,
  useMapEvents,
  useMap,
} from 'react-leaflet'
import type { LatLng } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { distancePointToPolygonEdge, isPointInRing } from '@/lib/geo'

// Fix default marker icon (webpack strips asset references)
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// PAC marker — orange disc with white center ring, distinct from the site
// marker. Custom divIcon avoids needing a separate image asset.
const pacMarkerIcon = L.divIcon({
  className: '',
  html: `<div style="width:22px;height:22px;background:#f97316;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 2px #f97316,0 1px 4px rgba(0,0,0,0.25);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -10],
})

interface SiteMapProps {
  initialLat: number
  initialLon: number
  initialZoom?: number
  onPositionChange: (lat: number, lon: number, zoom: number) => void
  /**
   * When true, render a "☀ Potentiel solaire" toggle that overlays the
   * federal SuisseEnergie/OFEN solar-suitability layer on the satellite
   * imagery. Default ON for the PV calculator (this is the killer feature
   * for selecting roof regions); call sites can pass `false` to suppress
   * (e.g. PAC calculator where solar potential is irrelevant).
   */
  enableSolarLayer?: boolean
  /**
   * When true, render a draggable PAC marker (orange disc), the federal
   * cadastre layer, and a live distance-to-property-line readout. Used on
   * the PAC calculator so the rep can position the heat pump unit and see
   * neighbor distances immediately.
   */
  enablePacPlacement?: boolean
  /**
   * Current PAC unit position. When undefined and enablePacPlacement is
   * true, the marker initializes ~5m east of the site marker.
   */
  pacLat?: number
  pacLon?: number
  /** Called when the rep drags the PAC marker. */
  onPacPositionChange?: (lat: number, lon: number) => void
}

interface RoofPopupData {
  lat: number
  lon: number
  loading: boolean
  found: boolean
  totalRoofAreaM2?: number
  totalCollectorAreaM2?: number
  annualYieldKwh?: number
  bestIrradiationKwhPerM2?: number
  bestKlasseLabel?: string
  bestKlasse?: number
  bestTiltDeg?: number
  surfaceCount?: number
  error?: string
}

export default function SiteMap({
  initialLat,
  initialLon,
  initialZoom = 17,
  onPositionChange,
  enableSolarLayer = true,
  enablePacPlacement = false,
  pacLat,
  pacLon,
  onPacPositionChange,
}: SiteMapProps) {
  // Track current marker position for zoom events
  const posRef = useRef({ lat: initialLat, lon: initialLon })
  // Solar overlay toggle — default ON when the feature is enabled
  const [showSolar, setShowSolar] = useState(enableSolarLayer)
  // Currently-displayed roof popup (null = no popup open)
  const [roofPopup, setRoofPopup] = useState<RoofPopupData | null>(null)
  // Fullscreen toggle — when true, the map renders as a fixed-inset modal
  // covering the whole viewport so the rep can place markers and inspect
  // roofs at maximum precision. Esc or close button exits.
  const [fullscreen, setFullscreen] = useState(false)

  // Esc to exit fullscreen
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  // Lock body scroll while fullscreen
  useEffect(() => {
    if (!fullscreen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [fullscreen])

  // ── PAC mode state ─────────────────────────────────────────────────────
  // Internal PAC marker position — initializes ~5m east of the site marker
  // when the parent doesn't pre-supply one. ~5m east = 5 / (111000 ×
  // cos(latitude)) ≈ 0.000065 degrees longitude at Swiss latitudes.
  const defaultPacLon = initialLon + 0.000065
  const [pacPos, setPacPos] = useState<{ lat: number; lon: number }>({
    lat: pacLat ?? initialLat,
    lon: pacLon ?? defaultPacLon,
  })
  // Property parcel polygon under the SITE marker. Cached after fetch so we
  // don't re-query swisstopo on every PAC drag.
  const [parcelRing, setParcelRing] = useState<[number, number][] | null>(null)
  const [parcelLoading, setParcelLoading] = useState(false)
  const [parcelError, setParcelError] = useState<string | null>(null)
  // Neighbor buildings (OSM) — fetched once when the site marker changes,
  // then filtered/distance-computed locally on every PAC drag.
  type NeighborBuilding = {
    id: number
    ring: [number, number][]
    address?: string
  }
  const [neighborBuildings, setNeighborBuildings] = useState<NeighborBuilding[]>([])

  // Sync PAC position from parent on prop change (address change re-init)
  useEffect(() => {
    if (pacLat != null && pacLon != null) {
      setPacPos({ lat: pacLat, lon: pacLon })
    } else {
      setPacPos({ lat: initialLat, lon: initialLon + 0.000065 })
      setParcelRing(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLat, initialLon])

  // Fetch the parcel polygon under the site marker whenever it moves (only
  // when PAC placement is enabled — saves an API call on the PV calculator).
  useEffect(() => {
    if (!enablePacPlacement) return
    let cancelled = false
    async function fetchParcel() {
      setParcelLoading(true)
      setParcelError(null)
      // Compute a small bbox around the site marker (~200m). swisstopo's
      // Identify needs the visible map bbox for tolerance-based hit testing.
      const dLat = 0.001
      const dLon = 0.0015
      const params = new URLSearchParams({
        lat: String(initialLat),
        lon: String(initialLon),
        west: String(initialLon - dLon),
        south: String(initialLat - dLat),
        east: String(initialLon + dLon),
        north: String(initialLat + dLat),
        w: '1280',
        h: '720',
      })
      try {
        const res = await fetch(`/api/swisstopo/parcel?${params}`)
        if (!res.ok) {
          if (!cancelled) setParcelError('Erreur')
          return
        }
        const data = await res.json()
        if (cancelled) return
        if (data.found) {
          setParcelRing(data.ring as [number, number][])
        } else {
          setParcelRing(null)
          setParcelError('Aucune parcelle')
        }
      } catch {
        if (!cancelled) setParcelError('Erreur réseau')
      } finally {
        if (!cancelled) setParcelLoading(false)
      }
    }
    fetchParcel()
    return () => {
      cancelled = true
    }
  }, [enablePacPlacement, initialLat, initialLon])

  // Fetch neighbor buildings (OSM) within ~80m of the site marker. Cached
  // for the lifetime of the site location; PAC drags re-use the cache.
  useEffect(() => {
    if (!enablePacPlacement) return
    let cancelled = false
    async function fetchBuildings() {
      try {
        const params = new URLSearchParams({
          lat: String(initialLat),
          lon: String(initialLon),
          radius: '80',
        })
        const res = await fetch(`/api/buildings/nearby?${params}`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setNeighborBuildings(data.buildings ?? [])
      } catch {
        /* silent — feature degrades gracefully when OSM is unavailable */
      }
    }
    fetchBuildings()
    return () => {
      cancelled = true
    }
  }, [enablePacPlacement, initialLat, initialLon])

  // Compute distance from PAC marker to nearest property edge whenever
  // either changes. Cheap math — runs on every drag.
  const edgeInfo = enablePacPlacement && parcelRing
    ? distancePointToPolygonEdge(pacPos, parcelRing)
    : null

  // Compute distance from PAC marker to the closest NEIGHBOR building
  // (excluding any building inside the customer's own parcel). Cheap math —
  // runs on every drag using the cached buildings array.
  const closestNeighbor = (() => {
    if (!enablePacPlacement || neighborBuildings.length === 0) return null

    let best: {
      distanceMeters: number
      closest: { lat: number; lon: number }
      address?: string
      ring: [number, number][]
    } | null = null

    for (const b of neighborBuildings) {
      // Skip the building if its centroid lies inside the customer's parcel.
      // (Can't always exclude — OSM building outline + parcel may not align
      // perfectly. Centroid test is a robust heuristic.)
      if (parcelRing) {
        const cx = b.ring.reduce((s, c) => s + c[0], 0) / b.ring.length
        const cy = b.ring.reduce((s, c) => s + c[1], 0) / b.ring.length
        if (isPointInRing({ lat: cy, lon: cx }, parcelRing)) continue
      }
      const r = distancePointToPolygonEdge(pacPos, b.ring)
      if (!r) continue
      if (!best || r.distanceMeters < best.distanceMeters) {
        best = {
          distanceMeters: r.distanceMeters,
          closest: r.closest,
          address: b.address,
          ring: b.ring,
        }
      }
    }
    return best
  })()

  // Keep posRef in sync when address autocomplete changes the coordinates
  useEffect(() => {
    posRef.current = { lat: initialLat, lon: initialLon }
  }, [initialLat, initialLon])

  const handleMarkerDrag = useCallback(
    (latlng: LatLng, zoom: number) => {
      posRef.current = { lat: latlng.lat, lon: latlng.lng }
      onPositionChange(latlng.lat, latlng.lng, zoom)
    },
    [onPositionChange]
  )

  // When the user clicks anywhere on the map, fetch roof info from
  // swisstopo's Identify API. Show a popup with the aggregated data, or a
  // friendly "no roof here" message if the click missed.
  const handleMapClick = useCallback(
    async (latlng: LatLng, bounds: L.LatLngBounds, size: { x: number; y: number }) => {
      const lat = latlng.lat
      const lon = latlng.lng

      // Open popup immediately in loading state
      setRoofPopup({ lat, lon, loading: true, found: false })

      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        west: String(bounds.getWest()),
        south: String(bounds.getSouth()),
        east: String(bounds.getEast()),
        north: String(bounds.getNorth()),
        w: String(size.x),
        h: String(size.y),
      })

      try {
        const res = await fetch(`/api/swisstopo/roof?${params}`)
        if (!res.ok) {
          setRoofPopup({ lat, lon, loading: false, found: false, error: 'Erreur de récupération' })
          return
        }
        const data = await res.json()
        if (!data.found) {
          setRoofPopup({ lat, lon, loading: false, found: false })
          return
        }
        setRoofPopup({
          lat,
          lon,
          loading: false,
          found: true,
          totalRoofAreaM2: data.totalRoofAreaM2,
          totalCollectorAreaM2: data.totalCollectorAreaM2,
          annualYieldKwh: data.annualYieldKwh,
          bestIrradiationKwhPerM2: data.bestIrradiationKwhPerM2,
          bestKlasseLabel: data.bestKlasseLabel,
          bestKlasse: data.bestKlasse,
          bestTiltDeg: data.bestTiltDeg,
          surfaceCount: data.surfaceCount,
        })
      } catch {
        setRoofPopup({ lat, lon, loading: false, found: false, error: 'Erreur réseau' })
      }
    },
    []
  )

  /*
    Inline default: 60vh, capped at 720px so it never feels overwhelming on
    huge monitors but fills well on a typical 13" laptop. Floor of 480px so
    it's always meaningfully large.
    Fullscreen: 95vh inside a fixed-inset modal — the rep gets nearly the
    entire viewport for placing markers and inspecting roofs.
  */
  const inlineHeight = 'min(720px, max(480px, 60vh))'
  const containerClass = fullscreen
    ? 'fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-sm flex flex-col p-4 sm:p-6'
    : ''
  const mapBoxClass = fullscreen
    ? 'rounded-lg overflow-hidden border border-gray-200 bg-white shadow-2xl flex-1 min-h-0'
    : 'rounded overflow-hidden border border-gray-200 relative'
  const mapBoxStyle: React.CSSProperties = fullscreen
    ? { height: 'auto' }
    : { height: inlineHeight }

  return (
    <div className={containerClass} onClick={fullscreen ? () => setFullscreen(false) : undefined}>
      <div
        className={mapBoxClass}
        style={mapBoxStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fullscreen toggle — floats top-right above Leaflet's own controls */}
        <button
          type="button"
          onClick={() => setFullscreen((f) => !f)}
          className="absolute top-2 right-2 z-[400] inline-flex items-center justify-center w-9 h-9 rounded bg-white/95 hover:bg-white border border-gray-200 shadow-md text-gray-700 hover:text-gray-900 transition-colors"
          title={fullscreen ? 'Quitter le plein écran (Échap)' : 'Plein écran'}
          aria-label={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
        >
          {fullscreen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4m8 0h4v4m0 8v4h-4m-8 0H4v-4" />
            </svg>
          )}
        </button>
        <MapContainer
          center={[initialLat, initialLon]}
          zoom={initialZoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          {/* Invalidate Leaflet's cached size when fullscreen toggles so
              tiles re-render correctly at the new dimensions */}
          <MapResizer trigger={fullscreen} />
          {/* Base layer — Swisstopo aerial imagery */}
          <TileLayer
            url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg"
            attribution='&copy; <a href="https://www.swisstopo.admin.ch">swisstopo</a>'
            maxZoom={20}
            minZoom={8}
          />
          {/*
            Solar potential overlay — ch.bfe.solarenergie-eignung-daecher.
            Federal SuisseEnergie/OFEN dataset showing per-roof solar
            suitability (kWh/m²/year). Yellow = lower potential, red = higher.
            Available zoom levels 8-20 (clamped). Rendered at 70% opacity so
            the building outlines underneath stay visible.
          */}
          {showSolar && (
            <TileLayer
              url="https://wmts.geo.admin.ch/1.0.0/ch.bfe.solarenergie-eignung-daecher/default/current/3857/{z}/{x}/{y}.png"
              attribution='Potentiel solaire &copy; <a href="https://www.suisseenergie.ch">SuisseEnergie / OFEN</a>'
              opacity={0.7}
              maxZoom={20}
              minZoom={8}
            />
          )}
          <MapCenter lat={initialLat} lon={initialLon} />
          <InnerMarker
            lat={initialLat}
            lon={initialLon}
            onDragEnd={handleMarkerDrag}
            onZoomChange={(zoom) =>
              onPositionChange(posRef.current.lat, posRef.current.lon, zoom)
            }
          />
          {/* Click handler — only attached when the solar layer is enabled */}
          {enableSolarLayer && <MapClickHandler onClick={handleMapClick} />}
          {/* Roof info popup */}
          {enableSolarLayer && roofPopup && (
            <Popup
              position={[roofPopup.lat, roofPopup.lon]}
              eventHandlers={{ remove: () => setRoofPopup(null) }}
              autoClose={false}
              closeOnClick={false}
            >
              <RoofPopupContent data={roofPopup} />
            </Popup>
          )}

          {/* PAC mode: cadastre overlay + parcel polygon + PAC marker +
              distance line to closest property edge */}
          {enablePacPlacement && (
            <>
              {/* Cadastral layer (swisstopo, free WMTS). Shows property
                  boundaries on top of satellite imagery. */}
              <TileLayer
                url="https://wmts.geo.admin.ch/1.0.0/ch.kantone.cadastralwebmap-farbe/default/current/3857/{z}/{x}/{y}.png"
                attribution='Cadastre &copy; <a href="https://www.cadastre.ch">cadastre.ch</a>'
                opacity={0.6}
                maxZoom={22}
                minZoom={14}
              />
              {/* Highlight the customer's parcel as a red outline */}
              {parcelRing && parcelRing.length > 2 && (
                <Polygon
                  positions={parcelRing.map(([lon, lat]) => [lat, lon])}
                  pathOptions={{
                    color: '#dc2626',
                    weight: 2,
                    fillColor: '#fca5a5',
                    fillOpacity: 0.05,
                  }}
                />
              )}
              {/* Dashed line from PAC marker to closest point on the property
                  edge — visually anchors the property-line distance */}
              {edgeInfo && (
                <Polyline
                  positions={[
                    [pacPos.lat, pacPos.lon],
                    [edgeInfo.closest.lat, edgeInfo.closest.lon],
                  ]}
                  pathOptions={{ color: '#f97316', weight: 2, dashArray: '6 4' }}
                />
              )}
              {/* Closest neighbor building — outlined in blue, with a solid
                  blue line to the PAC marker. Distinct from the parcel-line
                  visualization so the rep can read both at a glance. */}
              {closestNeighbor && (
                <>
                  <Polygon
                    positions={closestNeighbor.ring.map(([lon, lat]) => [lat, lon])}
                    pathOptions={{
                      color: '#2563eb',
                      weight: 2,
                      fillColor: '#93c5fd',
                      fillOpacity: 0.15,
                    }}
                  />
                  <Polyline
                    positions={[
                      [pacPos.lat, pacPos.lon],
                      [closestNeighbor.closest.lat, closestNeighbor.closest.lon],
                    ]}
                    pathOptions={{ color: '#2563eb', weight: 2 }}
                  />
                </>
              )}
              {/* PAC unit marker — orange, draggable */}
              <PacMarker
                lat={pacPos.lat}
                lon={pacPos.lon}
                onDragEnd={(latlng) => {
                  const next = { lat: latlng.lat, lon: latlng.lng }
                  setPacPos(next)
                  onPacPositionChange?.(next.lat, next.lon)
                }}
              />
            </>
          )}
        </MapContainer>
      </div>

      {/* Solar layer toggle + legend */}
      {enableSolarLayer && (
        <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowSolar((s) => !s)}
            className={`inline-flex items-center gap-2 text-xs font-medium rounded border px-2.5 py-1.5 transition-colors ${
              showSolar
                ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
            aria-pressed={showSolar}
            title="Potentiel solaire des toitures (SuisseEnergie / OFEN)"
          >
            <span aria-hidden>☀</span>
            <span>Potentiel solaire</span>
            <span className="text-[10px] text-gray-400 font-normal ml-1">
              {showSolar ? 'visible' : 'masqué'}
            </span>
          </button>

          {showSolar && (
            <div className="flex items-center gap-2 text-[10px] text-gray-500">
              <span>Faible</span>
              <span
                className="h-2 w-32 rounded-sm"
                style={{
                  background:
                    'linear-gradient(90deg, #ffffb2 0%, #fecc5c 33%, #fd8d3c 66%, #e31a1c 100%)',
                }}
                aria-hidden
              />
              <span>Élevé</span>
              <span className="text-gray-400 ml-1">kWh/m²/an</span>
            </div>
          )}
        </div>
      )}

      {/* PAC placement: distance display + helper copy */}
      {enablePacPlacement && (
        <div className="mt-2 rounded border border-orange-200 bg-orange-50 px-3 py-2.5">
          <div className="flex items-start gap-3 flex-wrap mb-2">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500 ring-2 ring-white shadow flex-shrink-0 mt-1" aria-hidden />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-orange-900 uppercase tracking-wider mb-1">
                Position de la pompe à chaleur
              </div>
              <p className="text-xs text-orange-800">
                Glissez le point orange sur l&apos;emplacement prévu de l&apos;unité extérieure.
                Les distances aux limites de propriété et au voisin le plus proche
                s&apos;affichent en direct.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Property line distance */}
            <div className="bg-white rounded px-3 py-2 border border-orange-100">
              <div className="text-[10px] font-semibold text-orange-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="inline-block w-3 h-0 border-t-2 border-orange-500 border-dashed" aria-hidden />
                Limite de propriété
              </div>
              {parcelLoading ? (
                <div className="text-xs text-gray-500 mt-1">Lecture cadastre…</div>
              ) : edgeInfo ? (
                <div className={`text-xl font-mono font-semibold tabular-nums leading-tight mt-0.5 ${edgeInfo.distanceMeters < 3 ? 'text-red-700' : 'text-orange-900'}`}>
                  {edgeInfo.distanceMeters.toFixed(1)} m
                </div>
              ) : parcelError ? (
                <div className="text-xs text-gray-500 mt-1">{parcelError}</div>
              ) : (
                <div className="text-xs text-gray-400 mt-1">—</div>
              )}
            </div>

            {/* Closest neighbor building distance */}
            <div className="bg-white rounded px-3 py-2 border border-blue-200">
              <div className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="inline-block w-3 h-0 border-t-2 border-blue-600" aria-hidden />
                Voisin le plus proche
              </div>
              {closestNeighbor ? (
                <>
                  <div className={`text-xl font-mono font-semibold tabular-nums leading-tight mt-0.5 ${closestNeighbor.distanceMeters < 6 ? 'text-red-700' : 'text-blue-900'}`}>
                    {closestNeighbor.distanceMeters.toFixed(1)} m
                  </div>
                  {closestNeighbor.address && (
                    <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                      {closestNeighbor.address}
                    </div>
                  )}
                </>
              ) : neighborBuildings.length === 0 ? (
                <div className="text-xs text-gray-500 mt-1">Recherche…</div>
              ) : (
                <div className="text-xs text-gray-400 mt-1">Aucun à proximité</div>
              )}
            </div>
          </div>

          {((edgeInfo && edgeInfo.distanceMeters < 3) ||
            (closestNeighbor && closestNeighbor.distanceMeters < 6)) && (
            <p className="text-xs text-red-700 font-medium mt-2 pt-2 border-t border-orange-200">
              ⚠ Distance courte — vérifiez la conformité dB(A) sur l&apos;outil cercle de bruit FWS.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Calls Leaflet's invalidateSize() whenever the trigger value changes.
// Required after the parent container resizes (e.g. fullscreen toggle) so
// Leaflet recomputes which tiles to load — otherwise the map stays at the
// old size with grey gaps.
function MapResizer({ trigger }: { trigger: unknown }) {
  const map = useMap()
  useEffect(() => {
    // Wait one frame for the parent div to settle into its new dimensions,
    // then nudge Leaflet to recompute. 80ms is enough for the CSS transition
    // and the layout pass that follows.
    const t = setTimeout(() => {
      map.invalidateSize()
    }, 80)
    return () => clearTimeout(t)
  }, [trigger, map])
  return null
}

// Pans the map to new coordinates when they change (e.g. after address autocomplete)
function MapCenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap()
  const prevRef = useRef({ lat, lon })

  useEffect(() => {
    if (prevRef.current.lat !== lat || prevRef.current.lon !== lon) {
      map.flyTo([lat, lon], map.getZoom())
      prevRef.current = { lat, lon }
    }
  }, [lat, lon, map])

  return null
}

function InnerMarker({
  lat,
  lon,
  onDragEnd,
  onZoomChange,
}: {
  lat: number
  lon: number
  onDragEnd: (latlng: LatLng, zoom: number) => void
  onZoomChange: (zoom: number) => void
}) {
  const map = useMapEvents({
    zoomend() {
      onZoomChange(map.getZoom())
    },
  })

  return (
    <Marker
      position={[lat, lon]}
      icon={markerIcon}
      draggable
      eventHandlers={{
        dragend(e) {
          onDragEnd(e.target.getLatLng(), map.getZoom())
        },
      }}
    />
  )
}

// Orange draggable PAC unit marker — uses pacMarkerIcon (custom divIcon).
// Doesn't capture clicks (so the solar identify still works behind it).
function PacMarker({
  lat,
  lon,
  onDragEnd,
}: {
  lat: number
  lon: number
  onDragEnd: (latlng: LatLng) => void
}) {
  return (
    <Marker
      position={[lat, lon]}
      icon={pacMarkerIcon}
      draggable
      eventHandlers={{
        dragend(e) {
          onDragEnd(e.target.getLatLng())
        },
      }}
    />
  )
}

// Captures map clicks (separate from the marker — the marker has its own
// drag handler but needs to NOT consume map clicks). Forwards lat/lon, the
// current visible bounds, and the pixel size to the parent.
function MapClickHandler({
  onClick,
}: {
  onClick: (latlng: LatLng, bounds: L.LatLngBounds, size: { x: number; y: number }) => void
}) {
  const map = useMapEvents({
    click(e) {
      // Skip clicks on Leaflet UI controls / markers (they don't bubble through
      // .leaflet-marker-pane, but pop-overs may interpose). Defensive check.
      const target = e.originalEvent.target as HTMLElement
      if (target.closest('.leaflet-marker-icon')) return
      const sz = map.getSize()
      onClick(e.latlng, map.getBounds(), { x: sz.x, y: sz.y })
    },
  })
  return null
}

// Popup content — handles loading / not-found / found states.
function RoofPopupContent({ data }: { data: RoofPopupData }) {
  if (data.loading) {
    return (
      <div className="text-xs text-gray-600 py-1">
        <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5 align-text-bottom" />
        Lecture du potentiel solaire…
      </div>
    )
  }

  if (data.error) {
    return <div className="text-xs text-red-600 py-1">{data.error}</div>
  }

  if (!data.found) {
    return (
      <div className="text-xs text-gray-600 py-1">
        Aucun toit cadastré ici. Cliquez sur un bâtiment.
      </div>
    )
  }

  const klasseColors: Record<number, string> = {
    1: 'bg-yellow-100 text-yellow-800',
    2: 'bg-amber-100 text-amber-800',
    3: 'bg-orange-100 text-orange-800',
    4: 'bg-red-100 text-red-800',
    5: 'bg-red-200 text-red-900',
  }
  const klasseClass = klasseColors[data.bestKlasse ?? 0] ?? 'bg-gray-100 text-gray-800'

  return (
    <div className="min-w-[220px] py-1" style={{ fontFamily: 'Geist, system-ui, sans-serif' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">☀</span>
        <span className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
          Potentiel solaire
        </span>
      </div>

      <div className={`inline-block text-[11px] font-semibold uppercase tracking-wider rounded px-2 py-0.5 mb-3 ${klasseClass}`}>
        {data.bestKlasseLabel} (classe {data.bestKlasse}/5)
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">Surface du toit</span>
          <span className="font-mono tabular-nums font-semibold text-gray-900">
            {data.totalRoofAreaM2?.toFixed(1)} m²
          </span>
        </div>
        {data.totalCollectorAreaM2 != null && data.totalCollectorAreaM2 > 0 && (
          <div className="flex justify-between gap-3 text-[10px] text-gray-400 -mt-0.5">
            <span>dont installable PV</span>
            <span className="font-mono tabular-nums">
              {data.totalCollectorAreaM2.toFixed(1)} m²
            </span>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">Production estimée</span>
          <span className="font-mono tabular-nums font-semibold text-red-600">
            {data.annualYieldKwh?.toLocaleString('fr-CH')} kWh/an
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">Meilleure exposition</span>
          <span className="font-mono tabular-nums font-semibold text-gray-900">
            {data.bestIrradiationKwhPerM2?.toLocaleString('fr-CH')} kWh/m²/an
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">Inclinaison (meilleur pan)</span>
          <span className="font-mono tabular-nums text-gray-700">
            {data.bestTiltDeg}°
          </span>
        </div>
        {data.surfaceCount && data.surfaceCount > 1 && (
          <div className="text-[10px] text-gray-400 mt-1.5">
            Agrégé sur {data.surfaceCount} pans de toiture
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">
        Source : SuisseEnergie / OFEN
      </p>
    </div>
  )
}
