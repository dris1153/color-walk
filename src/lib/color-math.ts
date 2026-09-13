export const BUCKET_COUNT = 24;
export const BUCKET_WIDTH = 360 / BUCKET_COUNT;

/** Wraps any finite hue (370, -10, 720) into 0..359.999. */
export function normalizeHue(h: number): number {
  if (!Number.isFinite(h)) return 0;
  return ((h % 360) + 360) % 360;
}

/** Shortest distance around the hue circle, 0..180. */
export function circularHueDistance(a: number, b: number): number {
  const d = Math.abs(normalizeHue(a) - normalizeHue(b));
  return d > 180 ? 360 - d : d;
}

/** Bucket 0 spans 352.5..360 and 0..7.5, so reds do not split across the wrap. */
export function hueToBucket(h: number): number {
  return Math.round(normalizeHue(h) / BUCKET_WIDTH) % BUCKET_COUNT;
}

export function bucketCenter(b: number): number {
  return normalizeHue(b * BUCKET_WIDTH);
}

/** h 0..359, s and l 0..100. */
export function hslToHex(h: number, s: number, l: number): string {
  const hue = normalizeHue(h);
  const sat = Math.min(100, Math.max(0, s)) / 100;
  const lig = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;
  const seg = Math.floor(hue / 60) % 6;
  const rgb: [number, number, number] =
    seg === 0 ? [c, x, 0]
    : seg === 1 ? [x, c, 0]
    : seg === 2 ? [0, c, x]
    : seg === 3 ? [0, x, c]
    : seg === 4 ? [x, 0, c]
    : [c, 0, x];
  const hex = rgb
    .map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0'))
    .join('');
  return `#${hex}`;
}

/**
 * How hard a lightness mismatch is punished, relative to a degree of hue.
 * Measured 2026-09-13: at hue 30 the top-60 sets for tone 20 and tone 80 are
 * completely disjoint at 0.3, 0.6 and 1.0 alike, so this is a feel choice.
 */
export const TONE_WEIGHT = 0.5;
/** Prefers the vivid work at equal hue. Unrelated to a reader-chosen tone. */
const VIVID_TIEBREAK = 0.15;

/**
 * Closest hue first, then closest lightness when a tone is chosen. Washed-out
 * works sink slightly so a vivid match outranks a grey one at the same hue.
 * Non-mutating, and stable within equal scores.
 *
 * Sorting rather than filtering is deliberate: no combination of hue and tone
 * can empty the grid, it only reorders what the hue already loaded. A null
 * target means no preference on that axis, which is how the all-colours view
 * can still be ordered by tone alone.
 */
export function sortByColorDistance<T extends { hue: number; sat: number; lig: number }>(
  items: readonly T[],
  targetH: number | null,
  targetL: number | null,
): T[] {
  const score = (it: T) =>
    (targetH === null ? 0 : circularHueDistance(it.hue, targetH)) +
    (100 - it.sat) * VIVID_TIEBREAK +
    (targetL === null ? 0 : Math.abs(it.lig - targetL) * TONE_WEIGHT);
  return [...items].sort((a, b) => score(a) - score(b));
}
