import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hslToHex } from './hsl-to-hex.mjs';
import { writeSpineFile } from './write-spine-file.mjs';
import { attachTwins, findTwins } from './write-twins.mjs';
import { writeCompositionFile } from './write-composition-file.mjs';
import { writeWordsFile } from './write-words-file.mjs';
import { writeErasFile } from './write-eras-file.mjs';

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
// Tie-broken by id so a rebuild cannot reshuffle equal works and churn the file.
const bySatDesc = (a, b) => b.sat - a.sat || a.id.localeCompare(b.id);
const byHueAsc = (a, b) => a.hue - b.hue || a.id.localeCompare(b.id);

/**
 * A work is filed under every colour it holds, not only its strongest, so a
 * painting with a blue sky is findable from blue. The copy filed under blue
 * *wears* blue: its hue, sat, lig, hex and pct are that colour's, and its own
 * palette lists the work's other colours. Filing it under blue while still
 * showing an ochre swatch would make the blue hue look broken.
 */
export function buildBuckets(items) {
  const buckets = Array.from({ length: BUCKET_COUNT }, (_, bucket) => ({
    bucket,
    center: bucket * BUCKET_WIDTH,
    count: 0,
    items: [],
  }));

  for (const item of items) {
    const colours = [[item.hue, item.sat, item.lig, item.pct], ...(item.p ?? [])];
    const placed = new Set();
    colours.forEach(([hue, sat, lig, share], i) => {
      const b = hueToBucket(hue);
      // Two of a work's colours can land in one 15-degree slice; it belongs there once.
      if (placed.has(b)) return;
      placed.add(b);
      const rest = colours.filter((_, j) => j !== i).map(([h, s, l, sh]) => [h, s, l, sh]);
      buckets[b].items.push(
        i === 0 ? item : { ...item, hue, sat, lig, hex: hslToHex(hue, sat, lig), pct: share, p: rest },
      );
    });
  }

  for (const b of buckets) {
    b.items.sort(byPctDesc);
    b.count = b.items.length;
  }
  return buckets;
}

/**
 * Taking the top 300 by pct put 299 of them in one bucket, every one at
 * pct >= 0.999: flat, aged-paper images, so a site about colour opened on almost
 * none of it. Instead an even share of every occupied bucket, most saturated
 * first within each. Thin hues are allocated first, so whatever they cannot fill
 * flows to the hues that can, and the result still lands on ALL_LIMIT. Ordered
 * by hue, so the grid reads as a walk around the wheel.
 */
export function buildAll(buckets) {
  const live = buckets.filter((b) => b.items.length > 0).sort((a, b) => a.items.length - b.items.length);
  const picked = [];
  let left = ALL_LIMIT;
  live.forEach((b, i) => {
    const take = Math.min(Math.ceil(left / (live.length - i)), b.items.length);
    picked.push(...[...b.items].sort(bySatDesc).slice(0, take));
    left -= take;
  });
  return { count: picked.length, items: picked.sort(byHueAsc) };
}

const bucketFileName = (b, page = 0) =>
  page === 0
    ? `bucket-${String(b).padStart(2, '0')}.json`
    : `bucket-${String(b).padStart(2, '0')}-${page}.json`;

export const pageCount = (total) => Math.max(1, Math.ceil(total / PAGE_SIZE));

const byLigAsc = (a, b) => a.lig - b.lig || a.id.localeCompare(b.id);

/**
 * The monochrome works: ink, calligraphy, prints, plain ceramics. They have no
 * hue to file under, only a tone, so they live in their own paged file.
 *
 * Pages are dealt round-robin from a tone-sorted list rather than sliced from
 * it. Slicing would put every dark work on page 0, which is the same mistake
 * the landing view used to make - the first screenful would have been one end
 * of the tonal range instead of a cross-section of it.
 */
export async function writeNeutralFiles(items, outDir) {
  const sorted = [...items].sort(byLigAsc);
  const pages = pageCount(sorted.length);
  const dealt = Array.from({ length: pages }, () => []);
  sorted.forEach((item, i) => dealt[i % pages].push(item));

  for (let page = 0; page < pages; page++) {
    const body =
      page === 0
        ? { count: sorted.length, pages, items: dealt[0] }
        : { page, items: dealt[page] };
    await writeFile(path.join(outDir, page === 0 ? 'neutral.json' : `neutral-${page}.json`), JSON.stringify(body));
  }
  return sorted.length;
}

/** Minified on purpose: pretty-printing this index costs ~30% more bytes in git and over the wire. */
export async function writeBucketFiles(items, outDir, dropped = {}, neutrals = []) {
  await mkdir(outDir, { recursive: true });
  const buckets = buildBuckets(items);
  const twins = findTwins(buckets);
  attachTwins(buckets, twins);
  // Where each work's primary entry landed, so a search result can be opened
  // with one page fetch. Then the map comes off the entries: it belongs to the
  // composition file, not to every bucket page.
  const located = new Map();
  for (const b of buckets) {
    b.items.forEach((entry, index) => {
      if (!located.has(entry.id) && !(entry.p ?? []).some((c) => c[3] > entry.pct)) {
        located.set(entry.id, { bucket: b.bucket, page: Math.floor(index / PAGE_SIZE) });
      }
    });
  }
  const composition = await writeCompositionFile(items, (id) => located.get(id), outDir);
  const words = await writeWordsFile(items, outDir);
  for (const b of buckets) for (const entry of b.items) delete entry.c;
  const all = buildAll(buckets);

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
  // Deliberately not in all.json: the landing view is a walk through colour,
  // and greys would only dilute it.
  const neutral = await writeNeutralFiles(neutrals, outDir);
  const spine = await writeSpineFile(items, neutrals, outDir);
  const dated = await writeErasFile(items, neutrals, outDir);
  const bySource = {};
  for (const i of items) bySource[i.src] = (bySource[i.src] ?? 0) + 1;

  const meta = {
    generatedAt: new Date().toISOString(),
    // `total` counts works; `entries` counts their places on the wheel, which is
    // larger because a work is filed under every colour it holds.
    total: items.length,
    entries: buckets.reduce((n, b) => n + b.count, 0),
    neutral,
    spine,
    twins: twins.size,
    composition,
    words,
    dated,
    bySource,
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
