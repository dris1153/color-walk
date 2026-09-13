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

function isItem(x: unknown): x is Item {
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

async function fetchBucket(url: string): Promise<Item[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('index-load-failed');
  const data: unknown = await res.json();
  const raw = (data as { items?: unknown })?.items;
  if (!Array.isArray(raw)) throw new Error('index-load-failed');
  return raw.filter(isItem);
}

/**
 * Every bucket file is fetched at most once per session: 25 static files,
 * ~3 MB in total, so the cache is bounded by design. In-flight requests are
 * shared rather than aborted - cancelling a same-origin static file saves
 * nothing and only earns a duplicate request on the next hue change.
 */
function loadOneBucket(bucket: number | null): Promise<Item[]> {
  const url = bucketFileUrl(bucket);
  const hit = bucketCache.get(url);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(url);
  if (pending) return pending;

  const request = fetchBucket(url)
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
