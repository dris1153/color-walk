import { TONE_MAX, TONE_MIN } from './color-math';
import type { Item } from './color-index-client';

/**
 * Two works closer than this in lightness are a coin toss dressed as a
 * question. Measured over the index, 61% of random pairs clear it, so the rule
 * costs almost nothing in material.
 */
export const MIN_TONE_GAP = 15;
/** How many draws before giving up on a fair pair; the pool is small and finite. */
const MAX_TRIES = 40;

export type TonePair = { a: Item; b: Item; darker: Item };

const pick = <T>(pool: readonly T[], random: () => number): T | null =>
  pool.length === 0 ? null : (pool[Math.floor(random() * pool.length)] ?? null);

/**
 * `random` is injected rather than reached for, so a question can be reproduced
 * exactly in a test. Returns null when the pool cannot make a fair question at
 * all, which the caller must handle rather than showing an unfair one.
 */
export function pickTonePair(pool: readonly Item[], random: () => number): TonePair | null {
  if (pool.length < 2) return null;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const a = pick(pool, random);
    const b = pick(pool, random);
    if (!a || !b || a.id === b.id) continue;
    if (Math.abs(a.lig - b.lig) < MIN_TONE_GAP) continue;
    return { a, b, darker: a.lig < b.lig ? a : b };
  }
  // The pool is too flat for a fair draw; say so instead of asking anyway.
  return null;
}

/**
 * Only works the slider can actually reach. 15% of the collection sits outside
 * 15..80, and asking about those pins the answer to an end of the track: the
 * reader cannot overshoot, and the number revealed is not the work's own tone.
 */
export function pickToneQuestion(pool: readonly Item[], random: () => number): Item | null {
  return pick(
    pool.filter((item) => item.lig >= TONE_MIN && item.lig <= TONE_MAX),
    random,
  );
}

/** Bands for the tone guess, widest first so the message reads as a verdict. */
export function toneVerdict(error: number): string {
  if (error <= 4) return 'Dead on';
  if (error <= 9) return 'Close';
  if (error <= 18) return 'In the region';
  return 'Off';
}
