import { circularHueDistance, type HueSelection } from './color-math';

/** A reading of the camera: a hue (or monochrome) and a lightness. */
export type Reading = { hue: HueSelection; lig: number };

/** Below these the grid would re-sort on sensor noise and a hand's small shake. */
export const MIN_HUE_CHANGE = 10;
export const MIN_TONE_CHANGE = 8;

/** Whether a new reading is different enough from the last to move the grid. */
export function changedEnough(last: Reading | null, next: Reading): boolean {
  if (!last) return true;
  if (typeof last.hue !== typeof next.hue) return true; // colour <-> monochrome
  if (Math.abs(last.lig - next.lig) >= MIN_TONE_CHANGE) return true;
  return typeof last.hue === 'number' && typeof next.hue === 'number' && circularHueDistance(last.hue, next.hue) >= MIN_HUE_CHANGE;
}
