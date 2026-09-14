import { bucketFileUrl, isAllowedImageUrl } from './image-url';
import { BUCKET_COUNT } from './color-math';

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
};

/** One reveal window. Below this a hue is padded from neighbouring buckets. */
export const MIN_ITEMS = 60;
/** Past half the wheel a work is no longer "this colour" by any reading. */
const MAX_RINGS = 11;

const HEX = /^#[0-9a-f]{6}$/i;
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
    isAllowedImageUrl(i.thumb)
  );
}

/** Page 0 of a bucket declares how many pages it has. Derived from the file, so
 * unlike a cursor it cannot drift out of step with what the caller holds. */
const totalPages = new Map<number, number>();

const pageUrl = (bucket: number | null, page: number): string =>
  page === 0
    ? bucketFileUrl(bucket)
    : `/index/bucket-${String(bucket).padStart(2, '0')}-${page}.json`;

async function fetchBucket(url: string, bucket: number | null): Promise<Item[]> {
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
function loadOneBucket(bucket: number | null, page = 0): Promise<Item[]> {
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
export async function loadBucketNear(bucket: number | null): Promise<Item[]> {
  if (bucket === null) return loadOneBucket(null);

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
export function hasMorePages(bucket: number | null, loaded: number): boolean {
  if (bucket === null) return false;
  return loaded < (totalPages.get(bucket) ?? 1);
}

/**
 * Only the primary bucket pages. Neighbours pad a thin hue, and a thin hue has
 * few works by definition, so their first 600 is already more than enough.
 */
export function loadBucketPage(bucket: number, page: number): Promise<Item[]> {
  return loadOneBucket(bucket, page);
}
