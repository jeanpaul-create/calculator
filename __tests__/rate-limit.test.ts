import { describe, it, expect } from 'vitest'
import { decideRateLimit } from '@/lib/rate-limit'

const MAX = 5
const WINDOW_MS = 60_000 // 1 minute

const t0 = new Date('2026-05-04T12:00:00.000Z')
const tHalfWindow = new Date(t0.getTime() + WINDOW_MS / 2)
const tAtWindowEnd = new Date(t0.getTime() + WINDOW_MS)
const tPastWindow = new Date(t0.getTime() + WINDOW_MS + 1000)

describe('decideRateLimit', () => {
  it("starts a new window when bucket is null (first call ever)", () => {
    const d = decideRateLimit(null, t0, WINDOW_MS, MAX)
    expect(d.action).toBe('reset')
    expect(d.remaining).toBe(MAX - 1)
    expect(d.resetAt.getTime()).toBe(t0.getTime() + WINDOW_MS)
  })

  it('increments when count is below the cap and window is active', () => {
    const bucket = { count: 2, resetAt: tAtWindowEnd }
    const d = decideRateLimit(bucket, tHalfWindow, WINDOW_MS, MAX)
    expect(d.action).toBe('increment')
    expect(d.remaining).toBe(MAX - 2 - 1) // 5 - 2 - 1 = 2
    expect(d.resetAt).toEqual(tAtWindowEnd)
  })

  it('denies when count is at the cap and window is active', () => {
    const bucket = { count: MAX, resetAt: tAtWindowEnd }
    const d = decideRateLimit(bucket, tHalfWindow, WINDOW_MS, MAX)
    expect(d.action).toBe('deny')
    expect(d.remaining).toBe(0)
    expect(d.resetAt).toEqual(tAtWindowEnd)
  })

  it('denies when count exceeds the cap (defensive — should not happen)', () => {
    const bucket = { count: MAX + 5, resetAt: tAtWindowEnd }
    const d = decideRateLimit(bucket, tHalfWindow, WINDOW_MS, MAX)
    expect(d.action).toBe('deny')
  })

  it('resets to a new window when the previous one has elapsed', () => {
    const bucket = { count: MAX, resetAt: tAtWindowEnd }
    const d = decideRateLimit(bucket, tPastWindow, WINDOW_MS, MAX)
    expect(d.action).toBe('reset')
    expect(d.remaining).toBe(MAX - 1)
    // New window starts NOW + windowMs (not from the old resetAt)
    expect(d.resetAt.getTime()).toBe(tPastWindow.getTime() + WINDOW_MS)
  })

  it('resets exactly when now equals resetAt (boundary inclusive)', () => {
    const bucket = { count: MAX, resetAt: tAtWindowEnd }
    const d = decideRateLimit(bucket, tAtWindowEnd, WINDOW_MS, MAX)
    expect(d.action).toBe('reset')
  })

  it('returns remaining = 0 on the call that exactly hits the cap', () => {
    // count = MAX-1 → this call increments to MAX → remaining = 0, still ok
    const bucket = { count: MAX - 1, resetAt: tAtWindowEnd }
    const d = decideRateLimit(bucket, tHalfWindow, WINDOW_MS, MAX)
    expect(d.action).toBe('increment')
    expect(d.remaining).toBe(0)
  })

  it('handles max=1 (single-shot window)', () => {
    const first = decideRateLimit(null, t0, WINDOW_MS, 1)
    expect(first.action).toBe('reset')
    expect(first.remaining).toBe(0)

    const second = decideRateLimit(
      { count: 1, resetAt: tAtWindowEnd },
      tHalfWindow,
      WINDOW_MS,
      1
    )
    expect(second.action).toBe('deny')
  })

  it('treats different keys independently (responsibility of caller)', () => {
    // The pure function operates on one bucket; isolation is guaranteed by
    // the caller passing distinct buckets per key. This test exists to
    // document that contract.
    const bucketA = { count: MAX, resetAt: tAtWindowEnd }
    const bucketB = { count: 1, resetAt: tAtWindowEnd }
    expect(decideRateLimit(bucketA, tHalfWindow, WINDOW_MS, MAX).action).toBe('deny')
    expect(decideRateLimit(bucketB, tHalfWindow, WINDOW_MS, MAX).action).toBe('increment')
  })
})
