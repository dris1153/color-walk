#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ALLOWED_IMAGE_HOSTS, ALLOWED_PAGE_HOSTS } from './normalize-artwork.mjs';
import { BUCKET_COUNT, hueToBucket, pageCount } from './write-bucket-files.mjs';
import { MAX_PALETTE } from './extract-dominant-color.mjs';

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

const meta = await read('meta.json');
let counted = 0;

for (let b = 0; b < BUCKET_COUNT; b++) {
  const pad = String(b).padStart(2, '0');
  const first = await read(`bucket-${pad}.json`);
  if (first.bucket !== b) fail(`bucket ${b}: file reports bucket ${first.bucket}`);
  if (first.count !== meta.byBucket[b]) fail(`bucket ${b}: count disagrees with meta.byBucket`);
  if (first.pages !== pageCount(first.count)) fail(`bucket ${b}: pages ${first.pages} wrong for ${first.count} items`);

  // Walk every page, so a bucket cannot quietly lose its overflow.
  let seen = 0;
  let previousPct = Infinity;
  for (let page = 0; page < first.pages; page++) {
    const file = page === 0 ? first : await read(`bucket-${pad}-${page}.json`);
    for (const item of file.items) {
      checkItem(item, b, fail);
      if (item.pct > previousPct) fail(`bucket ${b}: items not sorted by pct across page ${page}`);
      previousPct = item.pct;
      seen++;
    }
  }
  if (seen !== first.count) fail(`bucket ${b}: pages hold ${seen} items, count says ${first.count}`);
  counted += seen;
}

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

if (counted !== meta.total) fail(`bucket counts sum to ${counted}, meta.total is ${meta.total}`);
if (meta.total < MIN_TOTAL) fail(`meta.total ${meta.total} is below the ${MIN_TOTAL} floor`);

console.log(`checked ${counted} items across ${BUCKET_COUNT} buckets + all.json`);
console.log(`bySource ${JSON.stringify(meta.bySource)}  dropped ${JSON.stringify(meta.dropped)}`);
if (errors.length > 0) {
  console.error(`FAILED (${errors.length} shown):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exitCode = 1;
} else {
  console.log('OK');
}
