import { isItem, type Item } from './color-index-client';
import { isAllowedPageUrl } from './image-url';

const KEY = 'cw:favourites';
/** ~400-800 bytes per snapshot, so the whole list stays far under any quota. */
export const FAVOURITES_MAX = 200;

/**
 * A stored snapshot is untrusted by the time it comes back: the reader, an
 * extension or another tab could have edited it. It passes the same gate as an
 * item straight out of the index, plus a check on the museum link.
 */
const isSavedItem = (x: unknown): x is Item => isItem(x) && isAllowedPageUrl((x as Item).page);

/** Accessing localStorage itself throws when site data is blocked, so guard the lookup too. */
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readFavourites(): Item[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw: unknown = JSON.parse(store.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(isSavedItem).slice(0, FAVOURITES_MAX);
  } catch {
    return [];
  }
}

/**
 * Silent on failure. A full or blocked store must not break the page: the list
 * still lives in React state, so saving simply does not outlive the session.
 */
export function writeFavourites(items: readonly Item[]): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(items.slice(0, FAVOURITES_MAX)));
  } catch {
    /* quota or private mode */
  }
}

/** Pure, so the newest-first and cap behaviour is testable without a store. */
export function toggleIn(items: readonly Item[], item: Item): Item[] {
  const without = items.filter((i) => i.id !== item.id);
  if (without.length !== items.length) return without;
  return [item, ...without].slice(0, FAVOURITES_MAX);
}
