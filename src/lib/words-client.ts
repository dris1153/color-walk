import { BUCKET_COUNT } from './color-math';

/** A word from the titles and how its works spread over the 24 hues. */
export type WordColour = { w: string; n: number; h: readonly number[] };

const isWordColour = (x: unknown): x is WordColour => {
  if (typeof x !== 'object' || x === null) return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.w === 'string' &&
    e.w.length > 0 &&
    typeof e.n === 'number' &&
    Array.isArray(e.h) &&
    e.h.length === BUCKET_COUNT &&
    e.h.every((n) => typeof n === 'number' && n >= 0)
  );
};

let words: Promise<WordColour[]> | null = null;

/** ~10 kB, fetched when the reader first types, kept for the session. */
export function loadWords(): Promise<WordColour[]> {
  words ??= fetch('/index/words.json')
    .then((res) => {
      if (!res.ok) throw new Error('index-load-failed');
      return res.json();
    })
    .then((data: unknown) => {
      const raw = (data as { items?: unknown })?.items;
      if (!Array.isArray(raw)) throw new Error('index-load-failed');
      return raw.filter(isWordColour);
    })
    .catch((err: unknown) => {
      words = null; // never cache a failure, or a retry could not work
      throw err;
    });
  return words;
}

/** Prefix first, then anywhere, so typing "drag" offers "dragon" before "sundragon". */
export function suggest(all: readonly WordColour[], typed: string, limit = 8): WordColour[] {
  const q = typed.trim().toLowerCase();
  if (!q) return [];
  const starts = all.filter((e) => e.w.startsWith(q));
  const within = all.filter((e) => !e.w.startsWith(q) && e.w.includes(q));
  return [...starts, ...within].slice(0, limit);
}
