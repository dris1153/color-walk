import { normalizeHue } from './color-math';

/** Distance of the handle from the ring centre, as a percentage of its box. */
const HANDLE_RADIUS_PCT = 42;

/**
 * conic-gradient starts at 12 o'clock and runs clockwise; atan2 starts at
 * 3 o'clock. The +90 rotation is what keeps the handle on top of its colour.
 */
export function pointToHue(rect: DOMRect, clientX: number, clientY: number): number {
  const dx = clientX - (rect.left + rect.width / 2);
  const dy = clientY - (rect.top + rect.height / 2);
  return Math.round(normalizeHue((Math.atan2(dy, dx) * 180) / Math.PI + 90));
}

/** Inverse of pointToHue, as CSS percentages for absolute positioning. */
export function hueToHandlePosition(hue: number): { left: string; top: string } {
  const rad = (normalizeHue(hue) * Math.PI) / 180;
  return {
    left: `${50 + HANDLE_RADIUS_PCT * Math.sin(rad)}%`,
    top: `${50 - HANDLE_RADIUS_PCT * Math.cos(rad)}%`,
  };
}

export type RingSegment = { d: string; color: string; width: number };

/** The ring is drawn in a 100x100 viewBox. */
const CENTRE = 50;
const RADIUS = 42;
const THINNEST = 2.5;
const THICKEST = 11;
/** A sliver of ground between segments, so the ring reads as counted parts. */
const GAP_DEGREES = 1.6;

const polar = (radiusDeg: number, degrees: number): [number, number] => {
  const rad = (degrees * Math.PI) / 180;
  return [CENTRE + radiusDeg * Math.sin(rad), CENTRE - radiusDeg * Math.cos(rad)];
};

/**
 * One arc per populated hue bucket, its thickness carrying how many works live
 * there. Empty buckets produce no segment at all, so the collection's five dead
 * hues show as gaps rather than as a lie about having content.
 */
export function ringSegments(
  weights: readonly number[],
  hueColor: (hue: number) => string,
): RingSegment[] {
  const width = 360 / weights.length;
  const segments: RingSegment[] = [];

  weights.forEach((weight, index) => {
    if (weight <= 0) return;
    const centre = index * width;
    const start = centre - width / 2 + GAP_DEGREES / 2;
    const end = centre + width / 2 - GAP_DEGREES / 2;
    const [x1, y1] = polar(RADIUS, start);
    const [x2, y2] = polar(RADIUS, end);
    segments.push({
      d: `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${RADIUS} ${RADIUS} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      color: hueColor(centre),
      width: THINNEST + weight * (THICKEST - THINNEST),
    });
  });
  return segments;
}
