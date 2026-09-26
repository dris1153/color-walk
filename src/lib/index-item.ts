import { isAllowedImageUrl } from './image-url';
import { BUCKET_COUNT } from './color-math';
import { isKind, isRegion } from './facets';
import { isSource, type Source } from './museums';

/**
 * What one entry of the index looks like, and the gate every entry passes
 * before the app trusts it. The index is a file, and files get edited: a hex
 * reaches an inline style and a thumb reaches an <img src>, so both are checked
 * here rather than where they are used.
 */
/** A colour the work also holds: [hue, sat, lig, share]. `hex` is derived with
 *  hslToHex rather than stored, which is both smaller and safe by construction. */
export type PaletteEntry = readonly [number, number, number, number];

/** The work's nearest colour at the other museum, and where to find it: its
 *  own bucket, so resolving it costs at most one page. */
export type Twin = { id: string; bucket: number; page: number };

export type Item = {
  id: string;
  src: Source;
  t: string;
  a: string;
  d: string;
  w: number;
  h: number;
  thumb: string;
  big: string;
  bigBytes: number | null;
  hue: number;
  sat: number;
  lig: number;
  hex: string;
  pct: number;
  page: string;
  credit: string;
  p?: PaletteEntry[];
  twin?: Twin;
  /** The same colour a thousand years or more away, in the same shape as a twin. */
  echo?: Twin;
  /** Representative year (the middle of the dated span), when the museum gives one. */
  y?: number;
  /** Kind and region ids from facets.json. */
  k?: string;
  r?: string;
};


const HEX = /^#[0-9a-f]{6}$/i;

const isTwin = (x: unknown): x is Twin => {
  if (typeof x !== 'object' || x === null) return false;
  const t = x as Record<string, unknown>;
  return (
    typeof t.id === 'string' &&
    Number.isInteger(t.bucket) && (t.bucket as number) >= 0 && (t.bucket as number) < BUCKET_COUNT &&
    Number.isInteger(t.page) && (t.page as number) >= 0
  );
};

const isPalette = (x: unknown): x is PaletteEntry[] =>
  Array.isArray(x) &&
  x.every(
    (e) =>
      Array.isArray(e) &&
      e.length === 4 &&
      e.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
      e[0]! >= 0 &&
      e[0]! < 360,
  );

export function isItem(x: unknown): x is Item {
  if (typeof x !== 'object' || x === null) return false;
  const i = x as Record<string, unknown>;
  return (
    typeof i.id === 'string' &&
    // src names the museum in the overlay, so an unknown one is not shown at all.
    isSource(i.src) &&
    typeof i.thumb === 'string' &&
    typeof i.hue === 'number' &&
    i.hue >= 0 &&
    i.hue < 360 &&
    typeof i.w === 'number' &&
    i.w > 0 &&
    typeof i.h === 'number' &&
    i.h > 0 &&
    // hex reaches an inline style value, so it is checked before it is trusted
    typeof i.hex === 'string' &&
    HEX.test(i.hex) &&
    isAllowedImageUrl(i.thumb) &&
    (i.p === undefined || isPalette(i.p)) &&
    (i.twin === undefined || isTwin(i.twin)) &&
    (i.echo === undefined || isTwin(i.echo)) &&
    (i.y === undefined || Number.isInteger(i.y)) &&
    (i.k === undefined || isKind(i.k)) &&
    (i.r === undefined || isRegion(i.r))
  );
}
