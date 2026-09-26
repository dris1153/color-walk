import { BUCKET_COUNT } from './color-math';
import { isEra } from './facets';

/** One era: how many dated works, how many monochrome, and the rest by hue bucket. */
export type EraRow = { id: string; n: number; g: number; h: readonly number[] };

const isEraRow = (x: unknown): x is EraRow => {
  if (typeof x !== 'object' || x === null) return false;
  const e = x as Record<string, unknown>;
  return (
    isEra(e.id) &&
    typeof e.n === 'number' &&
    typeof e.g === 'number' &&
    Array.isArray(e.h) &&
    e.h.length === BUCKET_COUNT &&
    e.h.every((n) => typeof n === 'number' && n >= 0)
  );
};

let eras: Promise<EraRow[]> | null = null;

/** A few kB: the whole collection's colour history in one request, kept for the session. */
export function loadEras(): Promise<EraRow[]> {
  eras ??= fetch('/index/eras.json')
    .then((res) => {
      if (!res.ok) throw new Error('index-load-failed');
      return res.json();
    })
    .then((data: unknown) => {
      const raw = (data as { eras?: unknown })?.eras;
      if (!Array.isArray(raw)) throw new Error('index-load-failed');
      return raw.filter(isEraRow);
    })
    .catch((err: unknown) => {
      eras = null; // never cache a failure, or a retry could not work
      throw err;
    });
  return eras;
}
