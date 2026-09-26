import { isAllowedImageUrl, isIiifService } from './image-url';
import type { Item } from './index-item';

/** A master file up to this size is fine for a picture held on screen for seconds. */
const LARGE_MAX_BYTES = 4_000_000;
const IIIF_SIZE = '!1600,1600';

/**
 * The sharpest image worth loading for a full-screen view: a 1600 px render
 * from a IIIF service, the master file when it is known to be modest, and the
 * thumbnail otherwise.
 */
export function displayUrl(item: Pick<Item, 'thumb' | 'big' | 'bigBytes'>): string {
  if (isIiifService(item.big)) return item.big.replace(/\/info\.json$/, `/full/${IIIF_SIZE}/0/default.jpg`);
  if (isAllowedImageUrl(item.big) && item.bigBytes !== null && item.bigBytes <= LARGE_MAX_BYTES) return item.big;
  return item.thumb;
}
