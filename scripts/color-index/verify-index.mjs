#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ALLOWED_IMAGE_HOSTS, ALLOWED_PAGE_HOSTS } from './normalize-artwork.mjs';
import { BUCKET_COUNT, hueToBucket, pageCount } from './write-bucket-files.mjs';
import { MAX_PALETTE } from './extract-dominant-color.mjs';
import { verifySideFiles } from './verify-side-files.mjs';

const INDEX_DIR = path.join(import.meta.dirname, '..', '..', 'public', 'index');
const MIN_TOTAL = 5000;
const HEX = /^#[0-9a-f]{6}$/;

const read = async (name) => JSON.parse(await readFile(path.join(INDEX_DIR, name), 'utf8'));

function hostOk(url, hosts) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && hosts.has(u.hostname);
  } catch {
    return false;
  }
}

function checkItem(item, bucket, fail) {
  const at = `${item?.id ?? '?'} in bucket ${bucket}`;
  if (!hostOk(item.thumb, ALLOWED_IMAGE_HOSTS)) fail(`${at}: thumb host not allowed`);
  if (!hostOk(item.big, ALLOWED_IMAGE_HOSTS)) fail(`${at}: big host not allowed`);
  if (!hostOk(item.page, ALLOWED_PAGE_HOSTS)) fail(`${at}: page host not allowed`);
  if (!(item.hue >= 0 && item.hue < 360)) fail(`${at}: hue ${item.hue} out of range`);
  if (!(item.pct > 0 && item.pct <= 1)) fail(`${at}: pct ${item.pct} out of range`);
  if (!(item.w > 0 && item.h > 0)) fail(`${at}: missing dimensions`);
  if (!HEX.test(item.hex)) fail(`${at}: hex ${item.hex} malformed`);
  if (item.p !== undefined) {
    const ok =
      Array.isArray(item.p) &&
      item.p.length <= MAX_PALETTE &&
      item.p.every((e) => Array.isArray(e) && e.length === 4 && e[0] >= 0 && e[0] < 360);
    if (!ok) fail(`${at}: palette malformed`);
  }
  if (bucket !== null && hueToBucket(item.hue) !== bucket) fail(`${at}: hue belongs in bucket ${hueToBucket(item.hue)}`);
}

const errors = [];
const fail = (msg) => {
  if (errors.length < 20) errors.push(msg);
};

// A bucket can hold nothing but secondary-colour copies, and those works are
// filed in the spine under the hue they actually lead with.
const bucketOnlySecondary = new Set();

const meta = await read('meta.json');
let counted = 0;
const works = new Set();
/** One check per distinct twin reference; the same twin on many copies is one. */
const twinRefs = new Map();

for (let b = 0; b < BUCKET_COUNT; b++) {
  const pad = String(b).padStart(2, '0');
  const first = await read(`bucket-${pad}.json`);
  if (first.bucket !== b) fail(`bucket ${b}: file reports bucket ${first.bucket}`);
  if (first.count !== meta.byBucket[b]) fail(`bucket ${b}: count disagrees with meta.byBucket`);
  if (first.pages !== pageCount(first.count)) fail(`bucket ${b}: pages ${first.pages} wrong for ${first.count} items`);

  // Walk every page, so a bucket cannot quietly lose its overflow.
  let seen = 0;
  // Works whose own strongest colour is this hue, as opposed to copies filed
  // here for a colour they merely also hold.
  let leadsHere = 0;
  let previousPct = Infinity;
  for (let page = 0; page < first.pages; page++) {
    const file = page === 0 ? first : await read(`bucket-${pad}-${page}.json`);
    for (const item of file.items) {
      checkItem(item, b, fail);
      works.add(item.id);
      if (!item.p?.some((e) => e[3] > item.pct)) leadsHere++;
      if (item.twin && !twinRefs.has(item.id)) twinRefs.set([item.twin.bucket, item.twin.page], item);
      if (item.pct > previousPct) fail(`bucket ${b}: items not sorted by pct across page ${page}`);
      previousPct = item.pct;
      seen++;
    }
  }
  if (seen !== first.count) fail(`bucket ${b}: pages hold ${seen} items, count says ${first.count}`);
  if (seen > 0 && leadsHere === 0) bucketOnlySecondary.add(b);
  counted += seen;
}
const neutralFirst = await read('neutral.json');
if (neutralFirst.count !== meta.neutral) fail(`neutral.json: count disagrees with meta.neutral`);
if (neutralFirst.pages !== pageCount(neutralFirst.count)) fail('neutral.json: wrong page count');
let neutralSeen = 0;
for (let page = 0; page < neutralFirst.pages; page++) {
  const file = page === 0 ? neutralFirst : await read(`neutral-${page}.json`);
  let previousLig = -Infinity;
  for (const item of file.items) {
    checkItem(item, null, fail);
    if (item.sat !== 0) fail(`neutral page ${page}: ${item.id} has saturation ${item.sat}`);
    if (item.lig < previousLig) fail(`neutral page ${page}: items not sorted by tone`);
    previousLig = item.lig;
    neutralSeen++;
  }
  // Dealt round-robin, so every page must span the tonal range, not one end.
  const ligs = file.items.map((i) => i.lig);
  if (file.items.length > 50 && Math.max(...ligs) - Math.min(...ligs) < 20) {
    fail(`neutral page ${page}: covers only tones ${Math.min(...ligs)}..${Math.max(...ligs)}`);
  }
}
if (neutralSeen !== neutralFirst.count) {
  fail(`neutral pages hold ${neutralSeen} items, count says ${neutralFirst.count}`);
}

const { twinCount, composition, spine, spineBuckets } = await verifySideFiles({
  read, meta, fail, hostOk, ALLOWED_IMAGE_HOSTS, twinRefs, bucketOnlySecondary,
});

const all = await read('all.json');
if (all.count !== all.items.length) fail('all.json: count disagrees with items length');
if (all.count !== Math.min(300, meta.total)) fail(`all.json: expected ${Math.min(300, meta.total)} items, got ${all.count}`);
const allBuckets = new Set();
for (const [i, item] of all.items.entries()) {
  checkItem(item, null, fail);
  if (i > 0 && all.items[i - 1].hue > item.hue) fail('all.json: items not sorted by hue');
  allBuckets.add(hueToBucket(item.hue));
}
// The landing view must show the collection's colour range, not one bucket's.
const occupied = meta.byBucket.filter((n) => n > 0).length;
if (allBuckets.size < occupied) {
  fail(`all.json: covers ${allBuckets.size} of ${occupied} occupied buckets`);
}

// Entries outnumber works: a work is filed under every colour it holds.
if (counted !== meta.entries) fail(`buckets hold ${counted} entries, meta.entries is ${meta.entries}`);
if (works.size !== meta.total) fail(`buckets hold ${works.size} works, meta.total is ${meta.total}`);
if (counted < works.size) fail('entries cannot be fewer than works');
if (meta.total < MIN_TOTAL) fail(`meta.total ${meta.total} is below the ${MIN_TOTAL} floor`);

console.log(
  `checked ${works.size} works in ${counted} places across ${BUCKET_COUNT} buckets + all.json`,
);
console.log(`plus ${neutralSeen} monochrome works across ${neutralFirst.pages} pages`);
console.log(`spine holds ${spine.count} works reaching ${spineBuckets.size} hue buckets`);
console.log(`${twinCount} works have a twin at the other museum`);
console.log(`${composition.count} works have a composition map`);
console.log(`bySource ${JSON.stringify(meta.bySource)}  dropped ${JSON.stringify(meta.dropped)}`);
if (errors.length > 0) {
  console.error(`FAILED (${errors.length} shown):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exitCode = 1;
} else {
  console.log('OK');
}
