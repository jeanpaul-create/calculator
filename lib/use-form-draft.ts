'use client'

/**
 * Local draft persistence for the calculator forms.
 *
 * Before this existed, one accidental refresh / back-swipe / tab loss threw
 * away the whole in-progress quote (no server draft until an explicit save).
 *
 * Mechanics:
 *  - Dirty = the serialized snapshot differs from what it was at mount
 *    (self-contained; doesn't depend on the form's own isDirty wiring).
 *  - While dirty, the snapshot is written to localStorage (800ms debounce)
 *    under a stable key (`calc-draft:pv:new`, `calc-draft:pac:<quoteId>`, …).
 *  - On mount, an existing draft is surfaced as `pending` — the form shows a
 *    restore banner; restoring/ignoring is the form's call.
 *  - While dirty, a beforeunload prompt guards against accidental close.
 *  - `clear()` removes the draft and re-baselines (call on successful save).
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface DraftEnvelope<T> {
  at: number
  data: T
}

export function useFormDraft<T>(key: string, snapshot: T) {
  const json = JSON.stringify(snapshot)
  const baselineRef = useRef<string | null>(null)
  if (baselineRef.current === null) baselineRef.current = json
  const dirty = json !== baselineRef.current
  // Always-current snapshot for the stable clear() callback below.
  const jsonRef = useRef(json)
  jsonRef.current = json

  const [pending, setPending] = useState<DraftEnvelope<T> | null>(null)

  // Surface an existing draft once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const env = JSON.parse(raw) as DraftEnvelope<T>
        if (env && typeof env.at === 'number') setPending(env)
      }
    } catch {
      /* corrupted draft — ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Debounced save while dirty.
  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ at: Date.now(), data: JSON.parse(json) }))
      } catch {
        /* quota/serialization — draft is best-effort */
      }
    }, 800)
    return () => clearTimeout(t)
  }, [key, json, dirty])

  // Unsaved-changes guard.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  /** Remove the stored draft and re-baseline to the CURRENT state.
   *  Stable identity (ref-based) so save handlers can call it from
   *  useCallback closures without staleness. */
  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key)
    } catch {
      /* noop */
    }
    baselineRef.current = jsonRef.current
    setPending(null)
  }, [key])

  /** Dismiss the restore banner without touching current state. */
  const dismissPending = useCallback(() => {
    try {
      localStorage.removeItem(key)
    } catch {
      /* noop */
    }
    setPending(null)
  }, [key])

  return { pending, dirty, clear, dismissPending }
}

/** "il y a 12 min" style label for the restore banner. */
export function draftAgeLabel(at: number): string {
  const mins = Math.max(1, Math.round((Date.now() - at) / 60000))
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.round(mins / 60)
  return hours < 24 ? `il y a ${hours} h` : `il y a ${Math.round(hours / 24)} j`
}
