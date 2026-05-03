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
import { distancePointToPolygonEdge } from '@/lib/geo'

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

  // Compute distance from PAC marker to nearest property edge whenever
  // either changes. Cheap math — runs on every drag.
  const edgeInfo = enablePacPlacement && parcelRing
    ? distancePointToPolygonEdge(pacPos, parcelRing)
    : null

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
                  edge — visually anchors the displayed distance */}
              {edgeInfo && (
                <Polyline
                  positions={[
                    [pacPos.lat, pacPos.lon],
                    [edgeInfo.closest.lat, edgeInfo.closest.lon],
                  ]}
                  pathOptions={{ color: '#f97316', weight: 2, dashArray: '6 4' }}
                />
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
          <div className="flex items-start gap-3 flex-wrap">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500 ring-2 ring-white shadow flex-shrink-0 mt-1" aria-hidden />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-orange-900 uppercase tracking-wider mb-1">
                Position de la pompe à chaleur
              </div>
              <p className="text-xs text-orange-800">
                Glissez le point orange sur l&apos;emplacement prévu de l&apos;unité extérieure.
                La distance à la limite la plus proche s&apos;affiche en direct.
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              {parcelLoading ? (
                <span className="text-xs text-orange-700">Lecture cadastre…</span>
              ) : edgeInfo ? (
                <>
                  <div className="text-[10px] font-semibold text-orange-700 uppercase tracking-wider">
                    Distance limite
                  </div>
                  <div className="text-2xl font-mono font-semibold text-orange-900 tabular-nums leading-tight">
                    {edgeInfo.distanceMeters.toFixed(1)} m
                  </div>
                </>
              ) : parcelError ? (
                <span className="text-xs text-orange-700">{parcelError}</span>
              ) : (
                <span className="text-xs text-orange-700">—</span>
              )}
            </div>
          </div>
          {edgeInfo && edgeInfo.distanceMeters < 4 && (
            <p className="text-xs text-red-700 font-medium mt-2 pt-2 border-t border-orange-200">
              ⚠ Distance courte — vérifiez la conformité dB(A) sur l&apos;outil cercle de bruit FWS.
            </p>
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
