import { BUCKET_COUNT } from './color-math';
import { isEra } from './facets';
import { isAllowedImageUrl } from './image-url';
import { isSource, type Source } from './museums';

/** The work that shows hue bucket `h` best in era `e`, and where its entry lives. */
export type HistoryCell = {
  h: number;
  e: string;
  id: string;
  t: string;
  a: string;
  y: number;
  thumb: string;
  hex: string;
  src: Source;
  bucket: number;
  page: number;
};

const isCell = (x: unknown): x is HistoryCell => {
  if (typeof x !== 'object' || x === null) return false;
  const c = x as Record<string, unknown>;
  return (
    Number.isInteger(c.h) && (c.h as number) >= 0 && (c.h as number) < BUCKET_COUNT &&
    isEra(c.e) &&
    typeof c.id === 'string' &&
    typeof c.t === 'string' &&
    typeof c.a === 'string' &&
    Number.isInteger(c.y) &&
    typeof c.thumb === 'string' &&
    isAllowedImageUrl(c.thumb) &&
    // hex reaches an inline style, so it is checked like the index's own
    typeof c.hex === 'string' &&
    /^#[0-9a-f]{6}$/i.test(c.hex) &&
    isSource(c.src) &&
    Number.isInteger(c.bucket) &&
    Number.isInteger(c.page)
  );
};

let histories: Promise<HistoryCell[]> | null = null;

/** ~25 kB: one work per hue and era, kept for the session. */
export function loadHistories(): Promise<HistoryCell[]> {
  histories ??= fetch('/index/histories.json')
    .then((res) => {
      if (!res.ok) throw new Error('index-load-failed');
      return res.json();
    })
    .then((data: unknown) => {
      const raw = (data as { items?: unknown })?.items;
      if (!Array.isArray(raw)) throw new Error('index-load-failed');
      return raw.filter(isCell);
    })
    .catch((err: unknown) => {
      histories = null; // never cache a failure, or a retry could not work
      throw err;
    });
  return histories;
}
