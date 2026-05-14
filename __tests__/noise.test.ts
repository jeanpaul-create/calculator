/**
 * Tests for lib/noise.ts — OPB noise propagation model.
 *
 * Validates:
 *   - Formula: L_receiver = L_source - 20*log10(d) - 8 dB
 *   - OPB Class II thresholds (45 day, 35 night)
 *   - Inverse: minDistanceForThreshold gives the right cutoff distance
 *   - Edge cases (zero/negative inputs throw)
 */

import { describe, it, expect } from 'vitest'
import {
  calculateNoiseAtReceiver,
  minDistanceForThreshold,
  OPB_CLASS_II_DAY_DBA,
  OPB_CLASS_II_NIGHT_DBA,
} from '@/lib/noise'

describe('calculateNoiseAtReceiver', () => {
  it('at d=1m, level = Lw - 8 dB (no spreading loss)', () => {
    const r = calculateNoiseAtReceiver(60, 1)
    // 20*log10(1) = 0, so level = 60 - 0 - 8 = 52
    expect(r.levelDbA).toBeCloseTo(52, 1)
  })

  it('at d=10m, level = Lw - 28 dB', () => {
    const r = calculateNoiseAtReceiver(60, 10)
    // 20*log10(10) = 20, so level = 60 - 20 - 8 = 32
    expect(r.levelDbA).toBeCloseTo(32, 1)
  })

  it('doubling distance reduces level by 6 dB (inverse-square law)', () => {
    const a = calculateNoiseAtReceiver(60, 5)
    const b = calculateNoiseAtReceiver(60, 10)
    expect(a.levelDbA - b.levelDbA).toBeCloseTo(6.02, 1)
  })

  it('Class II day compliance (60 dB(A) PAC at 5m residential)', () => {
    const r = calculateNoiseAtReceiver(60, 5)
    // level = 60 - 13.98 - 8 = 38.02 dB(A) → day ok (≤45), night fails (>35)
    expect(r.levelDbA).toBeCloseTo(38.02, 1)
    expect(r.compliesDayClassII).toBe(true)
    expect(r.compliesNightClassII).toBe(false)
  })

  it('Class II night compliance requires more distance for loud PACs', () => {
    // Loud PAC (65 dB) at close range — night fails
    const close = calculateNoiseAtReceiver(65, 5)
    expect(close.compliesNightClassII).toBe(false)
    // Same PAC further out → eventually night passes
    const far = calculateNoiseAtReceiver(65, 25)
    expect(far.compliesNightClassII).toBe(true)
  })

  it('quiet PAC (50 dB) at 3m: day ok, night ok at residential', () => {
    const r = calculateNoiseAtReceiver(50, 3)
    // level = 50 - 9.54 - 8 = 32.46 dB(A) — well below both thresholds
    expect(r.levelDbA).toBeLessThan(OPB_CLASS_II_NIGHT_DBA)
    expect(r.compliesDayClassII).toBe(true)
    expect(r.compliesNightClassII).toBe(true)
  })

  it('throws on invalid Lw (zero or negative)', () => {
    expect(() => calculateNoiseAtReceiver(0, 5)).toThrow(/Invalid acoustic power/)
    expect(() => calculateNoiseAtReceiver(-10, 5)).toThrow(/Invalid acoustic power/)
  })

  it('throws on invalid distance (zero or negative)', () => {
    expect(() => calculateNoiseAtReceiver(60, 0)).toThrow(/Invalid distance/)
    expect(() => calculateNoiseAtReceiver(60, -5)).toThrow(/Invalid distance/)
  })
})

describe('minDistanceForThreshold', () => {
  it('inverse of calculateNoiseAtReceiver — round-trip consistency', () => {
    // At Lw=60, target=35, the threshold distance...
    const d = minDistanceForThreshold(60, 35)
    // ...should produce exactly 35 dB(A) when fed back into the forward formula
    const back = calculateNoiseAtReceiver(60, d)
    expect(back.levelDbA).toBeCloseTo(35, 2)
  })

  it('Class II night threshold for typical PAC ranges', () => {
    // 55 dB(A) PAC at OPB Class II night (35): d = 10^((55-8-35)/20)
    //   = 10^0.6 ≈ 3.98m. Most real-world PACs are 55-65 dB(A) which
    //   gives compliance distances of 4-12m — typical for residential
    //   setbacks.
    const d = minDistanceForThreshold(55, OPB_CLASS_II_NIGHT_DBA)
    expect(d).toBeGreaterThan(3)
    expect(d).toBeLessThan(8)
  })

  it('louder PAC requires more distance for same target', () => {
    const d60 = minDistanceForThreshold(60, 35)
    const d65 = minDistanceForThreshold(65, 35)
    expect(d65).toBeGreaterThan(d60)
  })
})
