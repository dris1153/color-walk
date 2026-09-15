import { isCompositionEntry, type CompositionEntry } from './composition-search';

let composition: Promise<CompositionEntry[]> | null = null;

/**
 * The ~4,500 works whose colour map varies, in one file of roughly 60 kB
 * compressed. Fetched only when the reader opens the search, and kept for the
 * session: nothing in it changes until the index is rebuilt.
 */
export function loadComposition(): Promise<CompositionEntry[]> {
  composition ??= fetch('/index/composition.json')
    .then((res) => {
      if (!res.ok) throw new Error('index-load-failed');
      return res.json();
    })
    .then((data: unknown) => {
      const raw = (data as { items?: unknown })?.items;
      if (!Array.isArray(raw)) throw new Error('index-load-failed');
      return raw.filter(isCompositionEntry);
    })
    .catch((err: unknown) => {
      composition = null; // never cache a failure, or a retry could not work
      throw err;
    });
  return composition;
}
