import names from './bucket-color-names.json';
import { hueToBucket } from './color-math';

/** One name per 15-degree bucket; index is the bucket, so bucket 0 = red. Kept
 *  in JSON because the build script that writes the per-hue share pages is .mjs
 *  and cannot import this module. */
export const BUCKET_COLOR_NAMES = names as readonly string[];

export function nearestColorName(hue: number): string {
  return BUCKET_COLOR_NAMES[hueToBucket(hue)] ?? 'Red';
}

/** Five bands over 0..100 lightness, used in the readout and in aria-valuetext. */
const TONE_NAMES = ['darkest', 'dark', 'mid', 'light', 'lightest'] as const;

export function toneName(tone: number): string {
  return TONE_NAMES[Math.min(4, Math.floor(tone / 20))] ?? 'mid';
}
