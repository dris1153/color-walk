/**
 * The landing view as the wheel itself: every work sits at its own hue angle.
 * Crowded hues cannot all fit on one ring, so a work that has no room beside its
 * neighbour falls to the next ring in. Density therefore reads as radial depth,
 * the same thing the control ring says with thickness.
 */

/**
 * Two rings, far enough apart to read as two. Four rings at 0.09 apart held
 * works 0.074 wide, so they touched and the whole thing read as one thick
 * smear with a pinhole in the middle rather than as a wheel.
 */
const RINGS = [0.45, 0.32, 0.19] as const;
/** A work's width as a fraction of the box. Kept relative, not in pixels, so the
 *  same works are placed at every screen size and nothing reflows on resize. */
export const ITEM_FRACTION = 0.085;

export type RingPlacement<T> = { item: T; left: number; top: number; ring: number };

const gapDegrees = (radius: number) => (ITEM_FRACTION / (2 * Math.PI * radius)) * 360;

/**
 * Same convention as the control ring: 0 degrees at twelve o'clock, clockwise.
 * Percentages, so the layout scales with the box and needs no measurement.
 */
function polar(hue: number, radius: number): { left: number; top: number } {
  const rad = (hue * Math.PI) / 180;
  return { left: 50 + radius * 100 * Math.sin(rad), top: 50 - radius * 100 * Math.cos(rad) };
}

export function packHueRing<T extends { hue: number }>(
  items: readonly T[],
  max = 120,
): RingPlacement<T>[] {
  const ordered = [...items].sort((a, b) => a.hue - b.hue);
  const last = RINGS.map(() => -Infinity);
  const first = RINGS.map<number | null>(() => null);
  const placed: RingPlacement<T>[] = [];

  for (const item of ordered) {
    if (placed.length >= max) break;
    for (let r = 0; r < RINGS.length; r++) {
      const gap = gapDegrees(RINGS[r]!);
      if (item.hue - last[r]! < gap) continue;
      // The ring closes on itself, so the last work must also clear the first.
      if (first[r] !== null && first[r]! + 360 - item.hue < gap) continue;
      last[r] = item.hue;
      if (first[r] === null) first[r] = item.hue;
      placed.push({ item, ring: r, ...polar(item.hue, RINGS[r]!) });
      break;
    }
  }
  return placed;
}
