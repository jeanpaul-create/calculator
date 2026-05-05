/**
 * Screen 1 — Votre toit (Recognition).
 *
 * Per design doc storyboard:
 *   Emotional beat: "wait, that's MY house"
 *   Dominant visual: full-bleed satellite + (planned) red roof outline
 *
 * Image source: swisstopo WMS (ch.swisstopo.swissimage), fetched server-side
 * via unstable_cache (24h revalidate, keyed on lat/lon/zoom). The image is
 * rendered as a data URL so it works inside the React tree without extra
 * round trips.
 *
 * Empty states (per design review issue 2.2):
 *   - No mapLat/mapLon on quote → "Demandez à votre conseiller de localiser
 *     votre toit"
 *   - mapLat present but image fetch returned null → "Image en cours de
 *     chargement" (cadastre fallback is a v1.x improvement; see TODOS)
 *
 * NOT yet implemented (added to TODOS during S4):
 *   - Red roof outline SVG overlay (needs swisstopo Identify data persisted
 *     on the quote at save time; today the data isn't on Quote/QuoteScenario)
 *   - Surface / irradiation / classe info grid below the image (same reason)
 */
'use client'

import type { CustomerFr } from '@/lib/i18n/customer-fr'

interface Props {
  mapImageDataUrl: string | null
  hasMapPosition: boolean
  customerFirstName: string | null
  strings: CustomerFr
}

export default function Screen1Roof({
  mapImageDataUrl,
  hasMapPosition,
  customerFirstName: _customerFirstName,
  strings,
}: Props) {
  return (
    <>
      <h1
        tabIndex={-1}
        className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded"
      >
        {strings.screen1.title}
      </h1>
      {mapImageDataUrl ? (
        <div className="flex-1 flex items-stretch rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
          {/* Full-bleed satellite. The image is captured at WIDTH=800 HEIGHT=500
              (5:4 aspect from the WMS request); object-cover crops to fit any
              container shape (portrait or landscape tablet). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mapImageDataUrl}
            alt="Vue aérienne du toit"
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>
      ) : (
        <EmptyState hasMapPosition={hasMapPosition} strings={strings} />
      )}
    </>
  )
}

function EmptyState({
  hasMapPosition,
  strings,
}: {
  hasMapPosition: boolean
  strings: CustomerFr
}) {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-100 border border-gray-200 rounded-lg">
      <div className="text-center max-w-md px-6">
        <div className="text-5xl text-gray-300 mb-4" aria-hidden="true">
          {/* Simple placeholder mark — no decorative blob, no gradient */}
          ◳
        </div>
        <p className="text-base text-gray-600 leading-relaxed">
          {hasMapPosition
            ? strings.screen1.fallback.imageUnavailable
            : strings.screen1.fallback.noMapPosition}
        </p>
      </div>
    </div>
  )
}
