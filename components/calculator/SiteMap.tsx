'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
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
