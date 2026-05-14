/**
 * Plan de situation — aerial map + parcel outline + neighbor buildings
 * + distance annotations. Used as a permit-pack attachment for Vaud
 * annonce PAC and permit path.
 *
 * Layout (A4 portrait):
 *   ┌──────────────────────────────────────┐
 *   │  PLAN DE SITUATION                   │  ← header
 *   │  {customer}  {quote#}  {site addr}   │
 *   ├──────────────────────────────────────┤
 *   │                                       │
 *   │  ┌────────────────────────────────┐  │
 *   │  │  swisstopo aerial + overlays   │  │  ← map at fixed aspect
 *   │  │    ─── parcel ring (red)       │  │
 *   │  │    ─── neighbors (gray)        │  │
 *   │  │    ─── distance lines + label  │  │
 *   │  │     × PAC location marker      │  │
 *   │  └────────────────────────────────┘  │
 *   │                                       │
 *   │  Distance aux voisins:                │
 *   │  • Bâtiment 1: 12.4 m                 │  ← table
 *   │  • Bâtiment 2: 18.7 m                 │
 *   │                                       │
 *   │  Source: swisstopo + OpenStreetMap    │  ← footer
 *   │  Échelle approximative                │
 *   └──────────────────────────────────────┘
 *
 * Coordinate projection:
 *   The aerial map is fetched as a 800×500 JPEG (see lib/quote-pdf.ts
 *   fetchMapImageBase64). Its bbox extends ±degOffset degrees around
 *   the quote's (mapLat, mapLon) where degOffset depends on zoom.
 *
 *   To overlay polygons in SVG coordinates aligned with the map image,
 *   we compute the SAME bbox the WMS request used, then linearly project
 *   each (lon, lat) point into the [0..800, 0..500] SVG viewBox.
 *
 *   This is approximate at high latitudes (Mercator distortion), but at
 *   Swiss latitudes (45-48°N) over a ~200m window, the error is sub-pixel.
 */

import React from 'react'
import {
  Document,
  Page,
  View,
  Text as PdfText,
  Image,
  StyleSheet,
  Svg,
  Polygon,
  Line,
  Circle,
} from '@react-pdf/renderer'

// ─── Types ───────────────────────────────────────────────────────────────────

interface NeighborForRender {
  id: number
  ring: [number, number][]  // [lon, lat][]
  address?: string
  distanceM: number
  /** Anchor point on the building (closest to the PAC location) for the distance line */
  anchor: [number, number]  // [lon, lat]
}

export interface PlanDeSituationProps {
  customerName: string | null
  quoteNumber: string
  siteAddress: string | null
  /** Aerial map image data URL (data:image/jpeg;base64,...) — null = empty map fallback */
  mapImageDataUrl: string | null
  /** PAC location (typically the quote's mapLat/mapLon) */
  pacLocation: { lat: number; lon: number }
  /** Map zoom level — must match the value used to fetch mapImageDataUrl */
  mapZoom: number
  /** Customer's parcel outer ring (red overlay). Null if cadastre lookup failed. */
  parcelRing: [number, number][] | null  // [lon, lat][]
  /** Adjacent buildings (gray overlay) with computed distances */
  neighbors: NeighborForRender[]
  generatedAt: Date
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAP_WIDTH_PX = 800
const MAP_HEIGHT_PX = 500
const MAP_ASPECT = MAP_WIDTH_PX / MAP_HEIGHT_PX

// Colors — match DESIGN.md customer-mode palette
const RED = '#d92127'
const GRAY_DARK = '#1c1917'
const GRAY_MID = '#6b7280'
const GRAY_LIGHT = '#d6d3d1'
const RED_TRANSPARENT = '#d9212733'  // 20% alpha for parcel fill

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: GRAY_DARK, fontFamily: 'Helvetica' },
  header: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: GRAY_MID },
  meta: { fontSize: 9, color: GRAY_MID, marginTop: 4 },
  mapContainer: {
    width: '100%',
    aspectRatio: MAP_ASPECT,
    border: `1pt solid ${GRAY_LIGHT}`,
    position: 'relative',
    backgroundColor: '#f5f5f4',
  },
  mapImage: { width: '100%', height: '100%' },
  mapOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  emptyMap: {
    width: '100%',
    aspectRatio: MAP_ASPECT,
    border: `1pt dashed ${GRAY_LIGHT}`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMapText: { color: GRAY_MID, fontSize: 10 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginTop: 16, marginBottom: 6 },
  distanceRow: { flexDirection: 'row', marginBottom: 2 },
  distanceLabel: { flex: 1, fontSize: 9 },
  distanceValue: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  footer: { marginTop: 20, paddingTop: 8, borderTop: `0.5pt solid ${GRAY_LIGHT}`, fontSize: 8, color: GRAY_MID },
})

// ─── Projection helper ──────────────────────────────────────────────────────

/**
 * Compute the WMS bbox the map image was fetched with. MUST mirror the
 * formula in lib/quote-pdf.ts:fetchMapImageBase64Uncached. If that file
 * changes its bbox formula, this must change in lockstep.
 */
function computeMapBbox(
  lat: number,
  lon: number,
  zoom: number
): { lonMin: number; latMin: number; lonMax: number; latMax: number } {
  const degOffset = 0.005 * Math.pow(2, 17 - Math.min(Math.max(zoom, 14), 20))
  return {
    lonMin: lon - degOffset,
    latMin: lat - degOffset,
    lonMax: lon + degOffset,
    latMax: lat + degOffset,
  }
}

/** Project a (lon, lat) to SVG pixel coordinates [0..800, 0..500]. */
function project(
  lon: number,
  lat: number,
  bbox: ReturnType<typeof computeMapBbox>
): [number, number] {
  const x = ((lon - bbox.lonMin) / (bbox.lonMax - bbox.lonMin)) * MAP_WIDTH_PX
  // SVG y=0 is at top; lat increases northward, so flip
  const y = ((bbox.latMax - lat) / (bbox.latMax - bbox.latMin)) * MAP_HEIGHT_PX
  return [x, y]
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PlanDeSituationPdf(props: PlanDeSituationProps) {
  const {
    customerName,
    quoteNumber,
    siteAddress,
    mapImageDataUrl,
    pacLocation,
    mapZoom,
    parcelRing,
    neighbors,
    generatedAt,
  } = props

  const bbox = computeMapBbox(pacLocation.lat, pacLocation.lon, mapZoom)
  const [pacX, pacY] = project(pacLocation.lon, pacLocation.lat, bbox)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <PdfText style={styles.title}>Plan de situation</PdfText>
          <PdfText style={styles.subtitle}>
            {customerName ?? '(client non renseigné)'} · {quoteNumber}
          </PdfText>
          {siteAddress && <PdfText style={styles.subtitle}>{siteAddress}</PdfText>}
          <PdfText style={styles.meta}>
            Généré le {generatedAt.toLocaleDateString('fr-CH')}
          </PdfText>
        </View>

        {mapImageDataUrl ? (
          <View style={styles.mapContainer}>
            <Image src={mapImageDataUrl} style={styles.mapImage} />
            <View style={styles.mapOverlay}>
              <Svg viewBox={`0 0 ${MAP_WIDTH_PX} ${MAP_HEIGHT_PX}`} width="100%" height="100%">
                {/* Parcel ring (red, semi-transparent fill) */}
                {parcelRing && parcelRing.length > 2 && (
                  <Polygon
                    points={parcelRing
                      .map(([lon, lat]) => project(lon, lat, bbox).join(','))
                      .join(' ')}
                    fill={RED_TRANSPARENT}
                    stroke={RED}
                    strokeWidth={2}
                  />
                )}

                {/* Neighbor buildings (gray) */}
                {neighbors.map((n) => (
                  <Polygon
                    key={`b-${n.id}`}
                    points={n.ring
                      .map(([lon, lat]) => project(lon, lat, bbox).join(','))
                      .join(' ')}
                    fill="none"
                    stroke={GRAY_MID}
                    strokeWidth={1}
                  />
                ))}

                {/* Distance lines + labels from PAC location to each neighbor anchor */}
                {neighbors.map((n) => {
                  const [nx, ny] = project(n.anchor[0], n.anchor[1], bbox)
                  return (
                    <React.Fragment key={`d-${n.id}`}>
                      <Line
                        x1={pacX}
                        y1={pacY}
                        x2={nx}
                        y2={ny}
                        stroke={RED}
                        strokeWidth={0.7}
                        strokeDasharray="3,2"
                      />
                    </React.Fragment>
                  )
                })}

                {/* PAC location marker */}
                <Circle cx={pacX} cy={pacY} r={5} fill={RED} stroke="white" strokeWidth={1} />
              </Svg>
            </View>
          </View>
        ) : (
          <View style={styles.emptyMap}>
            <PdfText style={styles.emptyMapText}>
              Image aérienne non disponible — coordonnées du site manquantes
            </PdfText>
          </View>
        )}

        {/* Distance table */}
        {neighbors.length > 0 && (
          <>
            <PdfText style={styles.sectionTitle}>
              Distances aux bâtiments voisins
            </PdfText>
            {neighbors
              .slice()
              .sort((a, b) => a.distanceM - b.distanceM)
              .map((n, i) => (
                <View key={n.id} style={styles.distanceRow}>
                  <PdfText style={styles.distanceLabel}>
                    {n.address ?? `Bâtiment ${i + 1}`}
                  </PdfText>
                  <PdfText style={styles.distanceValue}>
                    {n.distanceM.toFixed(1)} m
                  </PdfText>
                </View>
              ))}
          </>
        )}

        {neighbors.length === 0 && (
          <PdfText style={styles.sectionTitle}>
            Aucun bâtiment voisin détecté dans un rayon de 80 m.
          </PdfText>
        )}

        <View style={styles.footer}>
          <PdfText>
            Source: swisstopo (image aérienne et cadastre) · OpenStreetMap (bâtiments voisins).
            Échelle approximative — non destiné aux mesures de précision.
          </PdfText>
        </View>
      </Page>
    </Document>
  )
}
