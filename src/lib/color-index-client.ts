import { bucketFileUrl } from './image-url';
import { BUCKET_COUNT } from './color-math';
import { isItem, type Item, type Twin } from './index-item';

export { isItem, type Item, type PaletteEntry, type Twin } from './index-item';

/** One reveal window. Below this a hue is padded from neighbouring buckets. */
export const MIN_ITEMS = 60;
/** Past half the wheel a work is no longer "this colour" by any reading. */
const MAX_RINGS = 11;

const bucketCache = new Map<string, Item[]>();
const inflight = new Map<string, Promise<Item[]>>();

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

/**
 * The twin's page is usually already in the cache - it is the same bucket the
 * reader is browsing - and otherwise costs exactly the one fetch the index
 * promised. Null when the index and the page disagree, which the verifier
 * should have caught at build time.
 */
export async function loadTwin(twin: Twin): Promise<Item | null> {
  const page = await loadOneBucket(twin.bucket, twin.page);
  return page.find((item) => item.id === twin.id) ?? null;
}
