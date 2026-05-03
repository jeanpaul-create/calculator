'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import type { LatLng } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

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
}

interface RoofPopupData {
  lat: number
  lon: number
  loading: boolean
  found: boolean
  totalAreaM2?: number
  annualYieldKwh?: number
  avgRadiationPerM2?: number
  bestKlasseLabel?: string
  bestKlasse?: number
  avgTiltDeg?: number
  surfaceCount?: number
  error?: string
}

export default function SiteMap({
  initialLat,
  initialLon,
  initialZoom = 17,
  onPositionChange,
  enableSolarLayer = true,
}: SiteMapProps) {
  // Track current marker position for zoom events
  const posRef = useRef({ lat: initialLat, lon: initialLon })
  // Solar overlay toggle — default ON when the feature is enabled
  const [showSolar, setShowSolar] = useState(enableSolarLayer)
  // Currently-displayed roof popup (null = no popup open)
  const [roofPopup, setRoofPopup] = useState<RoofPopupData | null>(null)

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
          totalAreaM2: data.totalAreaM2,
          annualYieldKwh: data.annualYieldKwh,
          avgRadiationPerM2: data.avgRadiationPerM2,
          bestKlasseLabel: data.bestKlasseLabel,
          bestKlasse: data.bestKlasse,
          avgTiltDeg: data.avgTiltDeg,
          surfaceCount: data.surfaceCount,
        })
      } catch {
        setRoofPopup({ lat, lon, loading: false, found: false, error: 'Erreur réseau' })
      }
    },
    []
  )

  return (
    <div>
      <div className="rounded overflow-hidden border border-gray-200" style={{ height: 320 }}>
        <MapContainer
          center={[initialLat, initialLon]}
          zoom={initialZoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
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
    </div>
  )
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
          <span className="text-gray-500">Surface utile</span>
          <span className="font-mono tabular-nums font-semibold text-gray-900">
            {data.totalAreaM2?.toFixed(1)} m²
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">Production annuelle</span>
          <span className="font-mono tabular-nums font-semibold text-red-600">
            {data.annualYieldKwh?.toLocaleString('fr-CH')} kWh/an
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">Irradiation</span>
          <span className="font-mono tabular-nums text-gray-700">
            {data.avgRadiationPerM2?.toLocaleString('fr-CH')} kWh/m²/an
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">Inclinaison</span>
          <span className="font-mono tabular-nums text-gray-700">
            {data.avgTiltDeg}°
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
