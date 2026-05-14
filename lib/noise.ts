/**
 * OPB (Ordonnance sur la protection contre le bruit) noise propagation
 * model for outdoor PAC installations.
 *
 *   Reference: SR 814.41 Annexe 6 (PAC en plein air) + canton VD's
 *   simplified compliance procedure for the annonce path.
 *
 *   Spherical spreading with a ground-reflection correction:
 *
 *     L_receiver = L_source - 20 × log10(d) - 8 dB
 *
 *   Where:
 *     L_source   = PAC acoustic power [dB(A)] at 2°C
 *     d          = distance from PAC to receiver [m]
 *     -8 dB      = ground attenuation + spherical spreading factor for
 *                  Q=2 directivity (mounted near reflective surface).
 *                  This matches the simplified form used in the SIA
 *                  noise spreadsheet most installers reference.
 *
 *   The OPB compliance thresholds at the receiver (typically the nearest
 *   habitable window) depend on:
 *     - Noise sensitivity class I-IV of the receiver's plot zone
 *     - Day (07:00-19:00) vs. night (19:00-07:00)
 *     - Whether the source is new vs. existing
 *
 *   For new installations in Class II (most residential): ≤45 dB(A) day,
 *   ≤35 dB(A) night. Most cantons require night-time compliance since
 *   PACs may run during sleep hours.
 *
 *   v1 just COMPUTES the receiver level + flags day/night against Class II
 *   defaults. v1.x lets the rep pick the receiver's noise class.
 */

export interface NoiseAtReceiver {
  /** Distance from PAC to receiver in meters. */
  distanceM: number
  /** Predicted noise level at the receiver in dB(A). */
  levelDbA: number
  /** Day-time OPB compliance against Class II default (45 dB(A)). */
  compliesDayClassII: boolean
  /** Night-time OPB compliance against Class II default (35 dB(A)). */
  compliesNightClassII: boolean
}

/** OPB Class II thresholds (most residential zones). v1.x will let the rep override. */
export const OPB_CLASS_II_DAY_DBA = 45
export const OPB_CLASS_II_NIGHT_DBA = 35

/**
 * Calculate the noise level at a receiver point given the PAC's acoustic
 * power level and the straight-line distance.
 *
 * Uses the simplified spherical-spreading model with ground-reflection
 * correction. For distances > 50m, atmospheric absorption starts to
 * matter; this model overestimates noise slightly at longer ranges.
 * For PAC compliance (typically 3-30m to nearest neighbor) the model
 * is conservative enough.
 *
 * @param soundPowerDbA  PAC's acoustic power level Lw at 2°C in dB(A).
 *                       Typically 45-65 dB(A) for residential PACs.
 * @param distanceM      Distance from PAC source to receiver in meters.
 *                       Must be > 0; pass at least 1m for defensive safety.
 */
export function calculateNoiseAtReceiver(
  soundPowerDbA: number,
  distanceM: number
): NoiseAtReceiver {
  if (soundPowerDbA <= 0) {
    throw new Error(`Invalid acoustic power: ${soundPowerDbA} dB(A) (must be > 0)`)
  }
  if (distanceM <= 0) {
    throw new Error(`Invalid distance: ${distanceM} m (must be > 0)`)
  }
  // L_receiver = L_source - 20*log10(d) - 8 dB
  const levelDbA = soundPowerDbA - 20 * Math.log10(distanceM) - 8
  return {
    distanceM,
    levelDbA,
    compliesDayClassII: levelDbA <= OPB_CLASS_II_DAY_DBA,
    compliesNightClassII: levelDbA <= OPB_CLASS_II_NIGHT_DBA,
  }
}

/**
 * Inverse formula: minimum distance for a given PAC + receiver threshold.
 * Returns the distance in meters at which `soundPowerDbA - 20*log10(d) - 8`
 * equals `targetDbA`. Useful for "noise circle" visualization on a map.
 */
export function minDistanceForThreshold(
  soundPowerDbA: number,
  targetDbA: number
): number {
  // soundPowerDbA - 20*log10(d) - 8 = targetDbA
  // 20*log10(d) = soundPowerDbA - 8 - targetDbA
  // d = 10^((soundPowerDbA - 8 - targetDbA) / 20)
  return Math.pow(10, (soundPowerDbA - 8 - targetDbA) / 20)
}
