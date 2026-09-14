import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const BUCKET_COUNT = 24;
export const BUCKET_WIDTH = 360 / BUCKET_COUNT;
/** The wheel-centre "all colours" view; enough to fill several screens, small enough to ship. */
export const ALL_LIMIT = 300;
/**
 * Works per bucket file. At ~500 bytes an item that is roughly 55 KB gzipped,
 * small enough to fetch without blocking first paint. The hottest bucket holds
 * 4,407 works today and is projected past 30,000, so one file per bucket stopped
 * being viable; overflow spills into numbered pages instead of being capped.
 */
export const PAGE_SIZE = 600;

const wrap360 = (h) => ((h % 360) + 360) % 360;

/** Bucket 0 spans 352.5..360 and 0..7.5, so the red wrap stays in one file. */
export const hueToBucket = (h) => Math.round(wrap360(h) / BUCKET_WIDTH) % BUCKET_COUNT;

const byPctDesc = (a, b) => b.pct - a.pct;

export function buildBuckets(items) {
  const buckets = Array.from({ length: BUCKET_COUNT }, (_, bucket) => ({
    bucket,
    center: bucket * BUCKET_WIDTH,
    count: 0,
    items: [],
  }));
  for (const item of items) buckets[hueToBucket(item.hue)].items.push(item);
  for (const b of buckets) {
    b.items.sort(byPctDesc);
    b.count = b.items.length;
  }
  return buckets;
}

export function buildAll(items) {
  const top = [...items].sort(byPctDesc).slice(0, ALL_LIMIT);
  return { count: top.length, items: top };
}

const bucketFileName = (b, page = 0) =>
  page === 0
    ? `bucket-${String(b).padStart(2, '0')}.json`
    : `bucket-${String(b).padStart(2, '0')}-${page}.json`;

export const pageCount = (total) => Math.max(1, Math.ceil(total / PAGE_SIZE));

/** Minified on purpose: pretty-printing this index costs ~30% more bytes in git and over the wire. */
export async function writeBucketFiles(items, outDir, dropped = {}) {
  await mkdir(outDir, { recursive: true });
  const buckets = buildBuckets(items);
  const all = buildAll(items);

  for (const b of buckets) {
    const pages = pageCount(b.count);
    for (let page = 0; page < pages; page++) {
      const items = b.items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      // Page 0 carries the bucket's true total and page count; later pages are
      // just more items, fetched only once a reader scrolls that far.
      const body =
        page === 0
          ? { bucket: b.bucket, center: b.center, count: b.count, pages, items }
          : { bucket: b.bucket, page, items };
      await writeFile(path.join(outDir, bucketFileName(b.bucket, page)), JSON.stringify(body));
    }
  }
  await writeFile(path.join(outDir, 'all.json'), JSON.stringify(all));

  const meta = {
    generatedAt: new Date().toISOString(),
    total: items.length,
    bySource: {
      met: items.filter((i) => i.src === 'met').length,
      cma: items.filter((i) => i.src === 'cma').length,
    },
    byBucket: buckets.map((b) => b.count),
    dropped: {
      validation: dropped.validation ?? 0,
      achromatic: dropped.achromatic ?? 0,
      download: dropped.download ?? 0,
    },
  };
  await writeFile(path.join(outDir, 'meta.json'), JSON.stringify(meta));
  return meta;
}
