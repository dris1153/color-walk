import type { EraRow } from './eras-client';

/** Below this many works a hue's lift is noise, not a signature. */
const MIN_WORKS = 10;
/** A hue must be at least this much more common than usual to be the era's signature. */
const MIN_LIFT = 1.5;

export type Signature = { bucket: number; lift: number; count: number };

const chromatic = (row: EraRow) => row.h.reduce((a, b) => a + b, 0);

/**
 * Every era is mostly orange, so its most common hue says nothing. Its
 * signature is the hue most over-represented against the whole collection:
 * measured, azure x5.8 before 1000 BCE, violet x25 in the last millennium BCE,
 * blue x5 in the 1300s.
 */
export function signatureOf(row: EraRow, all: readonly EraRow[]): Signature | null {
  const total = all.reduce((sum, r) => sum + chromatic(r), 0);
  const eraTotal = chromatic(row);
  if (total === 0 || eraTotal === 0) return null;
  let best: Signature | null = null;
  row.h.forEach((count, bucket) => {
    if (count < MIN_WORKS) return;
    const overall = all.reduce((sum, r) => sum + (r.h[bucket] ?? 0), 0) / total;
    const lift = count / eraTotal / overall;
    if (lift >= MIN_LIFT && (!best || lift > best.lift)) best = { bucket, lift, count };
  });
  return best;
}

/** A hue's share of each era's coloured works, for the history timeline. */
export const hueShare = (row: EraRow, bucket: number): number => {
  const total = chromatic(row);
  return total > 0 ? (row.h[bucket] ?? 0) / total : 0;
};
