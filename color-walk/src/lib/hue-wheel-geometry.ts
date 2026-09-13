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
