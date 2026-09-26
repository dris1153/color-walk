import { BUCKET_COUNT, hueToBucket } from './write-bucket-files.mjs';
import { spineHueCell, spineToneBand } from './write-spine-file.mjs';

/**
 * The files beside the buckets: twins, the composition map, the spine and the
 * words. Each points back into the bucket pages, so each is checked against
 * them rather than only against itself. Pages are read once and their ids kept
 * in a Set: at 70,000 twins, reading a 300 kB page per twin took the verifier
 * from seconds to the better part of an hour.
 */
export async function verifySideFiles({
  read,
  meta,
  fail,
  checkItem,
  hostOk,
  ALLOWED_IMAGE_HOSTS,
  twinRefs,
  bucketOnlySecondary,
}) {
  const pages = new Map();
  const pageOf = async (bucket, page) => {
    const key = `${bucket}:${page}`;
    if (!pages.has(key)) {
      const name =
        page === 0
          ? `bucket-${String(bucket).padStart(2, '0')}.json`
          : `bucket-${String(bucket).padStart(2, '0')}-${page}.json`;
      const file = await read(name).catch(() => null);
      pages.set(key, file ? new Map(file.items.map((i) => [i.id, i])) : null);
    }
    return pages.get(key);
  };

  // Twins: each must point at a real entry, in the bucket and page it names, at
  // the other museum. A wrong page would cost the reader a fetch for nothing.
  let twinCount = 0;
  for (const [ref, item] of twinRefs) {
    const [bucket, page] = ref;
    const found = (await pageOf(bucket, page))?.get(item.twin.id);
    if (!found) fail(`${item.id}: twin ${item.twin.id} is not on bucket ${bucket} page ${page}`);
    else if (found.src === item.src) fail(`${item.id}: twin ${item.twin.id} is at the same museum`);
    twinCount++;
  }

  // Composition: every entry must be openable - its bucket and page must hold it -
  // and its nine cells must be cells.
  const composition = await read('composition.json');
  if (composition.count !== composition.items.length) fail('composition.json: count disagrees with items');
  if (composition.count !== meta.composition) fail('composition.json: count disagrees with meta.composition');
  for (const entry of composition.items) {
    if (!Array.isArray(entry.c) || entry.c.length !== 9) fail(`composition: ${entry.id} does not have nine cells`);
    else if (!entry.c.every((c) => c === null || (Array.isArray(c) && c.length === 2 && c[0] >= 0 && c[0] < 360))) {
      fail(`composition: ${entry.id} has a malformed cell`);
    }
    if (!hostOk(entry.thumb, ALLOWED_IMAGE_HOSTS)) fail(`composition: ${entry.id} thumb host not allowed`);
    if (!(await pageOf(entry.bucket, entry.page))?.has(entry.id)) {
      fail(`composition: ${entry.id} is not on bucket ${entry.bucket} page ${entry.page}`);
    }
  }

  // The spine: one small file that has to reach every corner, because the walk
  // and the games cannot fetch a bucket per hue.
  const spine = await read('spine.json');
  if (spine.count !== spine.items.length) fail('spine.json: count disagrees with items length');
  if (spine.count !== meta.spine) fail('spine.json: count disagrees with meta.spine');
  const spineIds = new Set();
  const spineCells = new Set();
  let lastHue = -Infinity;
  let seenNeutral = false;
  for (const item of spine.items) {
    checkItem(item, null, fail);
    if (spineIds.has(item.id)) fail(`spine.json: ${item.id} appears twice`);
    spineIds.add(item.id);
    if (item.sat === 0) {
      seenNeutral = true;
      continue;
    }
    // Neutrals have no hue, so they sit at the end rather than sorted among them.
    if (seenNeutral) fail('spine.json: a coloured work comes after the neutral ones');
    if (item.hue < lastHue) fail('spine.json: coloured items not ordered by hue');
    lastHue = item.hue;
    const cell = `${spineHueCell(item.hue)}:${spineToneBand(item.lig)}`;
    if (spineCells.has(cell)) fail(`spine.json: two works share cell ${cell}`);
    spineCells.add(cell);
  }
  // Every hue the index actually holds must be reachable from the spine alone.
  const spineBuckets = new Set(spine.items.filter((i) => i.sat > 0).map((i) => hueToBucket(i.hue)));
  for (let b = 0; b < BUCKET_COUNT; b++) {
    if (meta.byBucket[b] > 0 && !spineBuckets.has(b) && !bucketOnlySecondary.has(b)) {
      fail(`spine.json: hue bucket ${b} holds ${meta.byBucket[b]} entries but no spine work`);
    }
  }

  // Words: each a real word with a full 24-bucket histogram that sums to its count.
  const words = await read('words.json');
  if (words.count !== words.items.length) fail('words.json: count disagrees with items');
  if (words.count !== meta.words) fail('words.json: count disagrees with meta.words');
  for (const entry of words.items) {
    if (typeof entry.w !== 'string' || !/^[a-z]{4,}$/.test(entry.w)) fail(`words: malformed word ${JSON.stringify(entry.w)}`);
    if (!Array.isArray(entry.h) || entry.h.length !== BUCKET_COUNT) fail(`words: ${entry.w} lacks 24 buckets`);
    else if (entry.h.reduce((a, b) => a + b, 0) !== entry.n) fail(`words: ${entry.w} histogram does not sum to ${entry.n}`);
  }

  // Eras: one row per era in facets.json order, each histogram summing to its count.
  const eras = (await read('eras.json').catch(() => null)) ?? { undated: 0, eras: [] };
  if (eras.eras.length === 0) fail('eras.json: missing or empty - rebuild the index');
  let dated = 0;
  for (const row of eras.eras) {
    if (!Array.isArray(row.h) || row.h.length !== BUCKET_COUNT) fail(`eras: ${row.id} lacks 24 buckets`);
    else if (row.h.reduce((a, b) => a + b, 0) + row.g !== row.n) fail(`eras: ${row.id} does not sum to ${row.n}`);
    dated += row.n;
  }
  if (dated !== meta.dated) fail(`eras.json: ${dated} dated works, meta.dated is ${meta.dated}`);
  if (dated + eras.undated !== meta.total + meta.neutral) fail('eras.json: dated and undated do not add up to every work');

  return { twinCount, composition, spine, spineBuckets, words, eras };
}
