import { circularHueDistance } from './color-math';
import { isSource, type Source } from './museums';

/**
 * Searching by where colour sits, not only what it is. Entries come from
 * composition.json: the ~33% of works whose 3x3 map actually varies, each with
 * just enough to draw a result and open it.
 */
export type Cell = readonly [hue: number, lig: number] | null;

export type CompositionEntry = {
  id: string;
  t: string;
  thumb: string;
  hex: string;
  src: Source;
  bucket: number;
  page: number;
  c: readonly Cell[];
};

/** What the reader painted: a hue per cell, or null for "no opinion". */
export type Paint = readonly (number | null)[];

export const CELLS = 9;
/** Twelve hues, one every 30 degrees: enough to say "blue over gold" without a colour picker. */
export const PALETTE = Array.from({ length: 12 }, (_, i) => i * 30);
/** A painted cell the work has no colour in at all counts as this far off. */
const EMPTY_PENALTY = 90;
/** Averaged over painted cells, this is where a match stops being one. */
export const GOOD_MATCH = 30;

export const EMPTY_PAINT: Paint = Array.from({ length: CELLS }, () => null);

/** Null when nothing is painted: there is no question to score. */
export function scoreComposition(entry: CompositionEntry, paint: Paint): number | null {
  let painted = 0;
  let total = 0;
  paint.forEach((want, i) => {
    if (want === null) return;
    painted++;
    const cell = entry.c[i];
    total += cell ? circularHueDistance(cell[0], want) : EMPTY_PENALTY;
  });
  return painted === 0 ? null : total / painted;
}

export type CompositionMatch = { entry: CompositionEntry; score: number };

/**
 * Best first, good matches only. Reporting the count is the point: the reader
 * should see that "blue over gold" has 1,500 answers and "three different
 * colours in a row" has twelve, rather than wonder whether the search broke.
 */
export function searchComposition(
  entries: readonly CompositionEntry[],
  paint: Paint,
  limit = 60,
): { matches: CompositionMatch[]; total: number } {
  const scored: CompositionMatch[] = [];
  for (const entry of entries) {
    const score = scoreComposition(entry, paint);
    if (score !== null && score <= GOOD_MATCH) scored.push({ entry, score });
  }
  scored.sort((a, b) => a.score - b.score || a.entry.id.localeCompare(b.entry.id));
  return { matches: scored.slice(0, limit), total: scored.length };
}

const isCell = (x: unknown): x is Cell =>
  x === null ||
  (Array.isArray(x) &&
    x.length === 2 &&
    typeof x[0] === 'number' &&
    x[0] >= 0 &&
    x[0] < 360 &&
    typeof x[1] === 'number');

/** The file is untrusted like any other index file; a bad entry is dropped, not shown. */
export function isCompositionEntry(x: unknown): x is CompositionEntry {
  if (typeof x !== 'object' || x === null) return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.t === 'string' &&
    typeof e.thumb === 'string' &&
    typeof e.hex === 'string' &&
    /^#[0-9a-f]{6}$/i.test(e.hex) &&
    isSource(e.src) &&
    Number.isInteger(e.bucket) &&
    Number.isInteger(e.page) &&
    Array.isArray(e.c) &&
    e.c.length === CELLS &&
    e.c.every(isCell)
  );
}
