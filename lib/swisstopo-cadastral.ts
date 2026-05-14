/**
 * swisstopo WMS — cadastral webmap fetch.
 *
 * Returns a PNG of the swisstopo cadastral layer (parcel boundaries +
 * building footprints + roads + house numbers, rendered as line art)
 * centered on (lat, lon) at a configurable cartographic scale.
 *
 * Why a separate function from lib/quote-pdf.ts:fetchMapImageBase64?
 *   The existing aerial fetcher is zoom-based — bbox shrinks/grows with
 *   integer zoom levels and the result is the swissimage aerial photo.
 *   This fetcher is SCALE-based (1:500, 1:1000, etc.) and returns the
 *   cadastral webmap, which is what cantonal permit forms actually
 *   require for "plan de situation" attachments. Different inputs,
 *   different output, different cache key → separate module.
 *
 *   Scale computation:
 *
 *     real_world_width_m = (page_width_mm / 1000) × scale_denominator
 *
 *   At 47°N (Swiss mean):
 *     1° latitude  ≈ 111_000 m
 *     1° longitude ≈ 75_000 m  (cos(47°) × 111_000)
 *
 *   So to get a bbox covering N meters wide × M meters tall:
 *     deg_lon_offset = (N/2) / 75_000
 *     deg_lat_offset = (M/2) / 111_000
 *
 *   The function takes the target scale + the image aspect ratio
 *   (width/height) + the page width in mm, computes the bbox, fetches
 *   the WMS image at high pixel density (default 1600×1000 for crisp
 *   line art at 1:500).
 */

import { unstable_cache } from 'next/cache'

// Swiss bounds — same SSRF guard as the aerial fetcher
const SWISS_LAT_MIN = 45.5, SWISS_LAT_MAX = 47.9
const SWISS_LON_MIN = 5.9,  SWISS_LON_MAX = 10.6

// Approximate meters-per-degree at Swiss mean latitude (47°N).
// Good to ~5% across the country; fine for sub-100m bbox math.
const M_PER_DEG_LAT = 111_000
const M_PER_DEG_LON = 75_000 // 111_000 × cos(47°) ≈ 75_700

export interface CadastralBbox {
  lonMin: number
  latMin: number
  lonMax: number
  latMax: number
  /** Real-world width in meters (for scale-bar rendering) */
  widthMeters: number
  /** Real-world height in meters */
  heightMeters: number
}

export interface CadastralFetchOptions {
  /** Cartographic scale denominator (e.g. 500 = 1:500). */
  scaleDenominator: number
  /** Page-rendered map width in millimeters. Defaults to 182mm
   *  (A4 portrait minus standard 14mm padding each side ≈ 182mm). */
  pageWidthMm?: number
  /** Image aspect ratio (width/height). Defaults to 1.6 (matches the
   *  existing PlanDeSituationPdf 800×500 layout). */
  aspect?: number
  /** Source image pixel width. Higher = crisper at small bbox but
   *  larger payload. 1600 is enough for 1:500 at print resolution. */
  pixelWidth?: number
}

/**
 * Compute the bbox needed to render at the given scale at the given
 * page-rendered width. Public so callers (PDF component) can use the
 * same bbox for SVG-overlay coordinate projection.
 */
export function computeBboxForScale(
  lat: number,
  lon: number,
  opts: CadastralFetchOptions
): CadastralBbox {
  const pageWidthMm = opts.pageWidthMm ?? 182
  const aspect = opts.aspect ?? 1.6
  const widthMeters = (pageWidthMm / 1000) * opts.scaleDenominator
  const heightMeters = widthMeters / aspect
  const degOffsetLon = widthMeters / 2 / M_PER_DEG_LON
  const degOffsetLat = heightMeters / 2 / M_PER_DEG_LAT
  return {
    lonMin: lon - degOffsetLon,
    latMin: lat - degOffsetLat,
    lonMax: lon + degOffsetLon,
    latMax: lat + degOffsetLat,
    widthMeters,
    heightMeters,
  }
}

async function fetchCadastralMapBase64Uncached(
  lat: number,
  lon: number,
  scaleDenominator: number,
  pageWidthMm: number = 182,
  aspect: number = 1.6,
  pixelWidth: number = 1600
): Promise<string | null> {
  if (lat < SWISS_LAT_MIN || lat > SWISS_LAT_MAX || lon < SWISS_LON_MIN || lon > SWISS_LON_MAX) {
    return null
  }
  const bbox = computeBboxForScale(lat, lon, {
    scaleDenominator,
    pageWidthMm,
    aspect,
  })
  // WMS 1.3.0 with CRS=EPSG:4326 REQUIRES lat,lon axis order per the
  // spec — and swisstopo's cadastre layer enforces it. (The
  // ch.swisstopo.swissimage aerial layer happens to tolerate lon,lat
  // — probably because it's a global pyramid layer and the server's
  // tile cache lookups are permissive — but cadastre returns a 960-
  // byte black PNG with lon,lat order. Empirically verified against
  // wms.geo.admin.ch on 2026-05-14.)
  //
  // If you ever extend the existing lib/quote-pdf.ts:fetchMapImageBase64
  // (which uses lon,lat against swissimage and works) to a different
  // layer, check whether that layer is strict and flip accordingly.
  const bboxStr = `${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax}`
  const pixelHeight = Math.round(pixelWidth / aspect)
  const url =
    `https://wms.geo.admin.ch/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
    `&LAYERS=ch.kantone.cadastralwebmap-farbe&CRS=EPSG:4326` +
    `&BBOX=${bboxStr}&WIDTH=${pixelWidth}&HEIGHT=${pixelHeight}` +
    `&FORMAT=image/png&TRANSPARENT=false`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) {
      console.warn('[swisstopo-cadastral] WMS returned', res.status, 'for', url)
      return null
    }
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    return `data:image/png;base64,${base64}`
  } catch (err) {
    console.warn('[swisstopo-cadastral] fetch failed:', err)
    return null
  }
}

/**
 * Cached wrapper. 24h revalidate, keyed on (lat, lon, scale, pageWidth,
 * aspect, pixelWidth). Same address + same render config → same image,
 * fetched at most once per 24h. Same caching philosophy as the aerial
 * fetcher in lib/quote-pdf.ts.
 */
export const fetchCadastralMapBase64 = unstable_cache(
  fetchCadastralMapBase64Uncached,
  ['swisstopo-cadastral-wms'],
  { revalidate: 86400 }
)
