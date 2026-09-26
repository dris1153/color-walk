import { BUCKET_COUNT } from './color-math';
import { isRegion } from './facets';
import { isAllowedImageUrl } from './image-url';
import { isSource, type Source } from './museums';

/** One side of an echo pair: enough to draw it, and where its full entry lives. */
export type EchoWork = {
  id: string;
  t: string;
  y: number;
  thumb: string;
  hex: string;
  src: Source;
  r: string | null;
  bucket: number;
  page: number;
};
export type EchoPair = { a: EchoWork; b: EchoWork };

const isWork = (x: unknown): x is EchoWork => {
  if (typeof x !== 'object' || x === null) return false;
  const w = x as Record<string, unknown>;
  return (
    typeof w.id === 'string' &&
    typeof w.t === 'string' &&
    Number.isInteger(w.y) &&
    typeof w.thumb === 'string' &&
    isAllowedImageUrl(w.thumb) &&
    // hex reaches an inline style, so it is checked like the index's own
    typeof w.hex === 'string' &&
    /^#[0-9a-f]{6}$/i.test(w.hex) &&
    isSource(w.src) &&
    (w.r === null || isRegion(w.r)) &&
    Number.isInteger(w.bucket) && (w.bucket as number) >= 0 && (w.bucket as number) < BUCKET_COUNT &&
    Number.isInteger(w.page)
  );
};

const isPair = (x: unknown): x is EchoPair =>
  typeof x === 'object' && x !== null && isWork((x as EchoPair).a) && isWork((x as EchoPair).b);

let echoes: Promise<EchoPair[]> | null = null;

/** ~200 pairs, fetched when the reader opens them and kept for the session. */
export function loadEchoes(): Promise<EchoPair[]> {
  echoes ??= fetch('/index/echoes.json')
    .then((res) => {
      if (!res.ok) throw new Error('index-load-failed');
      return res.json();
    })
    .then((data: unknown) => {
      const raw = (data as { items?: unknown })?.items;
      if (!Array.isArray(raw)) throw new Error('index-load-failed');
      return raw.filter(isPair);
    })
    .catch((err: unknown) => {
      echoes = null; // never cache a failure, or a retry could not work
      throw err;
    });
  return echoes;
}
