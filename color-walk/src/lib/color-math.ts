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
 * Closest hue first; washed-out works sink slightly so a vivid match outranks
 * a grey one at the same hue. Non-mutating, and stable within equal scores.
 */
export function sortByHueDistance<T extends { hue: number; sat: number }>(
  items: readonly T[],
  targetH: number,
): T[] {
  const score = (it: T) =>
    circularHueDistance(it.hue, targetH) + (100 - it.sat) * 0.15;
  return [...items].sort((a, b) => score(a) - score(b));
}
