import { BUCKET_COUNT, hueToBucket } from './color-math';

/**
 * Which of the 24 hues the reader has actually kept something from. Monochrome
 * works are left out: they carry a placeholder hue of 0, so counting them would
 * quietly award the red segment to anyone who saved an ink drawing.
 */
export function collectedBuckets(
  items: readonly { hue: number; sat: number }[],
): Set<number> {
  const found = new Set<number>();
  for (const item of items) {
    if (item.sat > 0) found.add(hueToBucket(item.hue));
  }
  return found;
}

export const COLLECTABLE = BUCKET_COUNT;
