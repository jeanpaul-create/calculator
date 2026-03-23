'use client'

import { useRef, useCallback, useEffect } from 'react'
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
}

export default function SiteMap({
  initialLat,
  initialLon,
  initialZoom = 17,
  onPositionChange,
}: SiteMapProps) {
  // Track current marker position for zoom events
  const posRef = useRef({ lat: initialLat, lon: initialLon })

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
    <div className="rounded overflow-hidden border border-gray-200" style={{ height: 320 }}>
      <MapContainer
        center={[initialLat, initialLon]}
        zoom={initialZoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg"
          attribution='&copy; <a href="https://www.swisstopo.admin.ch">swisstopo</a>'
          maxZoom={20}
          minZoom={8}
        />
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
