import { bucketFileUrl, isAllowedImageUrl } from './image-url';
import { BUCKET_COUNT } from './color-math';

/** A colour the work also holds: [hue, sat, lig, share]. `hex` is derived with
 *  hslToHex rather than stored, which is both smaller and safe by construction. */
export type PaletteEntry = readonly [number, number, number, number];

export type Item = {
  id: string;
  src: 'met' | 'cma';
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
};

/** One reveal window. Below this a hue is padded from neighbouring buckets. */
export const MIN_ITEMS = 60;
/** Past half the wheel a work is no longer "this colour" by any reading. */
const MAX_RINGS = 11;

const HEX = /^#[0-9a-f]{6}$/i;

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
const bucketCache = new Map<string, Item[]>();
const inflight = new Map<string, Promise<Item[]>>();

export function isItem(x: unknown): x is Item {
  if (typeof x !== 'object' || x === null) return false;
  const i = x as Record<string, unknown>;
  return (
    typeof i.id === 'string' &&
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
    (i.p === undefined || isPalette(i.p))
  );
}

/** Page 0 of a bucket declares how many pages it has. Derived from the file, so
 * unlike a cursor it cannot drift out of step with what the caller holds. */
const totalPages = new Map<number | 'grey', number>();

const pageUrl = (bucket: number | null | 'grey', page: number): string =>
  page === 0 ? bucketFileUrl(bucket)
  : bucket === 'grey' ? `/index/neutral-${page}.json`
  : `/index/bucket-${String(bucket).padStart(2, '0')}-${page}.json`;

async function fetchBucket(url: string, bucket: number | null | 'grey'): Promise<Item[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('index-load-failed');
  const data: unknown = await res.json();
  const body = data as { items?: unknown; pages?: unknown };
  if (!Array.isArray(body?.items)) throw new Error('index-load-failed');
  if (bucket !== null && typeof body.pages === 'number') totalPages.set(bucket, body.pages);
  return body.items.filter(isItem);
}

/**
 * Every bucket file is fetched at most once per session: 25 static files,
 * ~3 MB in total, so the cache is bounded by design. In-flight requests are
 * shared rather than aborted - cancelling a same-origin static file saves
 * nothing and only earns a duplicate request on the next hue change.
 */
function loadOneBucket(bucket: number | null | 'grey', page = 0): Promise<Item[]> {
  const url = pageUrl(bucket, page);
  const hit = bucketCache.get(url);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(url);
  if (pending) return pending;

  const request = fetchBucket(url, bucket)
    .then((items) => {
      bucketCache.set(url, items);
      inflight.delete(url);
      return items;
    })
    .catch((err: unknown) => {
      inflight.delete(url); // never cache a failure, or Retry could not work
      throw err;
    });
  inflight.set(url, request);
  return request;
}

/**
 * The collection is heavily warm-biased: several 15-degree buckets are empty and
 * many hold under ten works. Loading only the exact bucket would leave most of
 * the wheel dead, so thin buckets are padded outward one ring at a time until
 * there is at least a screenful. The caller then sorts everything by distance to
 * the exact hue, so the closest colours still lead.
 */
export async function loadBucketNear(bucket: number | null | 'grey'): Promise<Item[]> {
  // Neither the all-colours sample nor the monochrome works have neighbours:
  // one is already a spread, the other has no hue to be near.
  if (bucket === null || bucket === 'grey') return loadOneBucket(bucket);

  const out = [...(await loadOneBucket(bucket))];
  for (let ring = 1; out.length < MIN_ITEMS && ring <= MAX_RINGS; ring++) {
    const above = (bucket + ring) % BUCKET_COUNT;
    const below = (bucket - ring + BUCKET_COUNT) % BUCKET_COUNT;
    const [a, b] = await Promise.all([loadOneBucket(above), loadOneBucket(below)]);
    out.push(...a, ...b);
  }
  return out;
}

/** `loaded` is the caller's own page count, so two views of one bucket cannot
 * steal each other's place in it. */
export function hasMorePages(bucket: number | null | 'grey', loaded: number): boolean {
  if (bucket === null) return false;
  return loaded < (totalPages.get(bucket) ?? 1);
}

/**
 * Only the primary bucket pages. Neighbours pad a thin hue, and a thin hue has
 * few works by definition, so their first 600 is already more than enough.
 */
export function loadBucketPage(bucket: number | 'grey', page: number): Promise<Item[]> {
  return loadOneBucket(bucket, page);
}

let spine: Promise<Item[]> | null = null;

/**
 * Every corner of the collection in one ~12 kB file. The bucket files are
 * organised for browsing one hue at a time, so anything that has to move across
 * hues would otherwise fetch a dozen of them. Cached for the session: it is one
 * request, and nothing in it changes until the index is rebuilt.
 */
export function loadSpine(): Promise<Item[]> {
  spine ??= fetch('/index/spine.json')
    .then((res) => {
      if (!res.ok) throw new Error('index-load-failed');
      return res.json();
    })
    .then((data: unknown) => {
      const raw = (data as { items?: unknown })?.items;
      if (!Array.isArray(raw)) throw new Error('index-load-failed');
      return raw.filter(isItem);
    })
    .catch((err: unknown) => {
      spine = null; // never cache a failure, or a retry could not work
      throw err;
    });
  return spine;
}
