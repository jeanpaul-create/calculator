/**
 * Plan de situation — cadastral map + parcel outline + adjacent-parcel
 * buildings + distance annotations + 1:500 scale bar.
 *
 * Layout (A4 portrait, 1:500 scale):
 *   ┌──────────────────────────────────────┐
 *   │  PLAN DE SITUATION   Échelle 1:500   │
 *   │  {customer}  {quote#}  {site addr}   │
 *   ├──────────────────────────────────────┤
 *   │                                       │
 *   │  ┌────────────────────────────────┐  │
 *   │  │  swisstopo cadastral webmap    │  │  ← 18.2cm wide
 *   │  │    ─── parcel ring (red)       │  │     91m × 57m real-world
 *   │  │    ─── adjacent buildings      │  │     (1:500 scale)
 *   │  │    ─── distance lines + label  │  │
 *   │  │     × PAC location marker      │  │
 *   │  │  ▓▓▓▓▓ 10 m                    │  │  ← scale bar
 *   │  └────────────────────────────────┘  │
 *   │                                       │
 *   │  Distances aux parcelles adjacentes:  │
 *   │  • Bâtiment 1: 12.4 m                 │
 *   │  • Bâtiment 2: 18.7 m                 │
 *   │                                       │
 *   │  Source: swisstopo cadastral webmap   │
 *   └──────────────────────────────────────┘
 *
 * Scale guarantee:
 *   The page-content width (A4 595pt - 40pt padding each side = 515pt
 *   ≈ 18.16cm) × 500 = 9080cm = 90.8m. The filler computes a bbox 91m
 *   wide and passes it to this component. When the PDF prints at 100%
 *   on A4, the rendered map is 1:500.
 *
 * Coordinate projection:
 *   The bbox is passed in as a prop (filler decides scale, component
 *   doesn't recompute). The SVG overlay projects (lon, lat) into the
 *   [0..1600, 0..1000] viewBox using a simple linear transform — at
 *   1:500 over 91m of width, Mercator distortion is sub-millimeter.
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
  Rect,
} from '@react-pdf/renderer'

// ─── Types ───────────────────────────────────────────────────────────────────

interface NeighborForRender {
  id: number
  ring: [number, number][]
  address?: string
  distanceM: number
  anchor: [number, number]
}

export interface MapBbox {
  lonMin: number
  latMin: number
  lonMax: number
  latMax: number
  widthMeters: number
  heightMeters: number
}

export interface PlanDeSituationProps {
  customerName: string | null
  quoteNumber: string
  siteAddress: string | null
  /** Cadastral webmap image data URL (data:image/png;base64,...) — null = empty map */
  mapImageDataUrl: string | null
  /** PAC location (= quote's mapLat/mapLon, also the bbox center) */
  pacLocation: { lat: number; lon: number }
  /** BBox the map image was fetched with. The filler computes this from
   *  the chosen scale; component uses it for SVG-overlay projection. */
  bbox: MapBbox
  /** Cartographic scale denominator (e.g. 500 = 1:500). Displayed in
   *  the header + drives the scale-bar segment length. */
  scaleDenominator: number
  /** Customer's parcel outer ring (red overlay). Null if cadastre lookup failed. */
  parcelRing: [number, number][] | null
  /** Adjacent-parcel buildings only (post-filter) with computed distances. */
  neighbors: NeighborForRender[]
  generatedAt: Date
}

// ─── Constants ───────────────────────────────────────────────────────────────

// SVG viewBox dimensions — must match the source WMS image aspect to
// avoid stretching. We render at 1600×1000 for high-density line art.
const SVG_WIDTH = 1600
const SVG_HEIGHT = 1000

const RED = '#d92127'
const GRAY_DARK = '#1c1917'
const GRAY_MID = '#6b7280'
const GRAY_LIGHT = '#d6d3d1'
const BLACK = '#000000'
const RED_FILL = '#d9212722'  // ~13% alpha — light wash so cadastral lines underneath stay readable
const BUILDING_FILL = '#6b728033'  // gray wash for adjacent buildings

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: GRAY_DARK, fontFamily: 'Helvetica' },
  header: { marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { flex: 1 },
  headerRight: { textAlign: 'right' },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: GRAY_MID },
  scaleLabel: { fontSize: 12, fontWeight: 700, color: GRAY_DARK },
  meta: { fontSize: 9, color: GRAY_MID, marginTop: 4 },
  mapContainer: {
    width: '100%',
    aspectRatio: SVG_WIDTH / SVG_HEIGHT,
    border: `1pt solid ${GRAY_LIGHT}`,
    position: 'relative',
    backgroundColor: '#ffffff',
  },
  mapImage: { width: '100%', height: '100%' },
  mapOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  emptyMap: {
    width: '100%',
    aspectRatio: SVG_WIDTH / SVG_HEIGHT,
    border: `1pt dashed ${GRAY_LIGHT}`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMapText: { color: GRAY_MID, fontSize: 10 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginTop: 14, marginBottom: 6 },
  distanceRow: { flexDirection: 'row', marginBottom: 2 },
  distanceLabel: { flex: 1, fontSize: 9 },
  distanceValue: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  footer: {
    marginTop: 16,
    paddingTop: 8,
    borderTop: `0.5pt solid ${GRAY_LIGHT}`,
    fontSize: 8,
    color: GRAY_MID,
  },
})

// ─── Projection helper ──────────────────────────────────────────────────────

function project(
  lon: number,
  lat: number,
  bbox: MapBbox
): [number, number] {
  const x = ((lon - bbox.lonMin) / (bbox.lonMax - bbox.lonMin)) * SVG_WIDTH
  // SVG y=0 is at top; lat increases northward, so flip
  const y = ((bbox.latMax - lat) / (bbox.latMax - bbox.latMin)) * SVG_HEIGHT
  return [x, y]
}

/** Compute the scale-bar segment in SVG-pixel units. 10m at the chosen
 *  scale, projected into our SVG viewBox. */
function scaleBarPixels(bbox: MapBbox): { pxFor10m: number; pxFor1m: number } {
  const svgPxPerMeter = SVG_WIDTH / bbox.widthMeters
  return {
    pxFor10m: svgPxPerMeter * 10,
    pxFor1m: svgPxPerMeter,
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PlanDeSituationPdf(props: PlanDeSituationProps) {
  const {
    customerName,
    quoteNumber,
    siteAddress,
    mapImageDataUrl,
    pacLocation,
    bbox,
    scaleDenominator,
    parcelRing,
    neighbors,
    generatedAt,
  } = props

  const [pacX, pacY] = project(pacLocation.lon, pacLocation.lat, bbox)
  const { pxFor10m } = scaleBarPixels(bbox)
  // Scale-bar position: bottom-left of the map, 30px in from each edge
  const scaleBarX = 30
  const scaleBarY = SVG_HEIGHT - 50
  const scaleBarHeight = 8

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <PdfText style={styles.title}>Plan de situation</PdfText>
            <PdfText style={styles.subtitle}>
              {customerName ?? '(client non renseigné)'} · {quoteNumber}
            </PdfText>
            {siteAddress && <PdfText style={styles.subtitle}>{siteAddress}</PdfText>}
            <PdfText style={styles.meta}>
              Établi le {generatedAt.toLocaleDateString('fr-CH')}
            </PdfText>
          </View>
          <View style={styles.headerRight}>
            <PdfText style={styles.scaleLabel}>
              Échelle 1:{scaleDenominator}
            </PdfText>
            <PdfText style={styles.meta}>
              Fenêtre: {bbox.widthMeters.toFixed(0)}m × {bbox.heightMeters.toFixed(0)}m
            </PdfText>
          </View>
        </View>

        {mapImageDataUrl ? (
          <View style={styles.mapContainer}>
            <Image src={mapImageDataUrl} style={styles.mapImage} />
            <View style={styles.mapOverlay}>
              <Svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} width="100%" height="100%">
                {/* Customer's parcel (red, light fill so cadastral lines underneath stay legible) */}
                {parcelRing && parcelRing.length > 2 && (
                  <Polygon
                    points={parcelRing
                      .map(([lon, lat]) => project(lon, lat, bbox).join(','))
                      .join(' ')}
                    fill={RED_FILL}
                    stroke={RED}
                    strokeWidth={3}
                  />
                )}

                {/* Adjacent-parcel buildings only (filtered by the filler) */}
                {neighbors.map((n) => (
                  <Polygon
                    key={`b-${n.id}`}
                    points={n.ring
                      .map(([lon, lat]) => project(lon, lat, bbox).join(','))
                      .join(' ')}
                    fill={BUILDING_FILL}
                    stroke={GRAY_DARK}
                    strokeWidth={1.5}
                  />
                ))}

                {/* Distance lines from PAC location to each adjacent-building closest edge */}
                {neighbors.map((n) => {
                  const [nx, ny] = project(n.anchor[0], n.anchor[1], bbox)
                  return (
                    <Line
                      key={`d-${n.id}`}
                      x1={pacX}
                      y1={pacY}
                      x2={nx}
                      y2={ny}
                      stroke={RED}
                      strokeWidth={1.2}
                      strokeDasharray="6,4"
                    />
                  )
                })}

                {/* PAC location marker — slightly larger for legibility on cadastre line art */}
                <Circle cx={pacX} cy={pacY} r={9} fill={RED} stroke="white" strokeWidth={2} />

                {/* Scale bar — 10m segment at 1:500 = 20mm on print.
                    Drawn as a white-bordered black bar with "10 m" label. */}
                <Rect
                  x={scaleBarX - 2}
                  y={scaleBarY - 2}
                  width={pxFor10m + 4}
                  height={scaleBarHeight + 16}
                  fill="white"
                  opacity={0.9}
                />
                <Rect
                  x={scaleBarX}
                  y={scaleBarY}
                  width={pxFor10m}
                  height={scaleBarHeight}
                  fill={BLACK}
                  stroke={BLACK}
                />
                {/* Tick marks at 0, 5, 10 */}
                <Line
                  x1={scaleBarX + pxFor10m / 2}
                  y1={scaleBarY - 2}
                  x2={scaleBarX + pxFor10m / 2}
                  y2={scaleBarY + scaleBarHeight + 2}
                  stroke="white"
                  strokeWidth={1}
                />
                {/* Label is rendered as a <View> overlay below — see
                    after the Svg block. react-pdf's text-in-svg API is
                    fiddly enough that an absolutely-positioned <View>
                    is cleaner. */}
              </Svg>
              {/* Overlay the scale label as plain HTML (positioned absolutely
                  on the map container). Cleaner than fighting <Text> inside
                  nested <Svg>. */}
              <View
                style={{
                  position: 'absolute',
                  left: `${(scaleBarX / SVG_WIDTH) * 100}%`,
                  top: `${((scaleBarY + scaleBarHeight + 2) / SVG_HEIGHT) * 100}%`,
                  width: 100,
                }}
              >
                <PdfText style={{ fontSize: 8, color: BLACK, fontWeight: 700 }}>
                  10 m
                </PdfText>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyMap}>
            <PdfText style={styles.emptyMapText}>
              Image cadastrale non disponible — coordonnées du site manquantes
              ou service swisstopo indisponible
            </PdfText>
          </View>
        )}

        {/* Distance table — adjacent parcels only */}
        {neighbors.length > 0 && (
          <>
            <PdfText style={styles.sectionTitle}>
              Distances aux bâtiments des parcelles adjacentes
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
            Aucun bâtiment détecté sur les parcelles adjacentes.
          </PdfText>
        )}

        <View style={styles.footer}>
          <PdfText>
            Source: swisstopo (webmap cadastrale) · OpenStreetMap (bâtiments).
            Plan de situation à l'échelle 1:{scaleDenominator}. Imprimer à 100% sur A4
            pour préserver l'échelle.
          </PdfText>
        </View>
      </Page>
    </Document>
  )
}
