#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';
import { pool } from './http-util.mjs';
import { acquireLock, createControl } from './crawl-control.mjs';
import { readRecords } from './jsonl-cache.mjs';
import { parseArgs } from './build-args.mjs';
import { MET_CACHE, fetchMetObjects } from './fetch-met-objects.mjs';
import { CMA_CACHE, CMA_LEGACY_CACHE, fetchCmaArtworks } from './fetch-cma-artworks.mjs';
import { RIJKS_CACHE, fetchRijksRecords } from './fetch-rijks-records.mjs';
import { NGA_CACHE, fetchNgaObjects } from './fetch-nga-objects.mjs';
import { SOURCES, normalizeArtwork } from './normalize-artwork.mjs';
import { downloadThumbnails, readCachedThumb } from './download-thumbnails.mjs';
import { extractDominantColor } from './extract-dominant-color.mjs';
import { extractComposition } from './extract-composition.mjs';
import { writeBucketFiles } from './write-bucket-files.mjs';

const OUT_DIR = path.join(import.meta.dirname, '..', '..', 'public', 'index');
const started = Date.now();
const stamp = (msg) => {
  const s = String(Math.round((Date.now() - started) / 1000)).padStart(4);
  console.log(`[${s}s] ${msg}`);
};

/**
 * Streams the raw caches rather than loading them: at 60k Met objects the
 * combined raw JSON is ~148 MB, and only the normalised item is worth keeping.
 */
async function normalizeAll({ sources, limit }) {
  const byId = new Map();
  let dropped = 0;
  // The old CMA cache speaks only for types the new one has not reached: a work
  // missing from a refetched type has left CC0 or the catalogue, and its old
  // record must not bring it back.
  const fresh = { ids: new Set(), types: new Set() };
  for await (const record of readRecords(CMA_CACHE)) {
    if (!record?.o) continue;
    fresh.ids.add(String(record.o.id));
    fresh.types.add(record.o.type);
  }
  const superseded = (o) => fresh.ids.has(String(o.id)) || fresh.types.has(o.type);
  // First sighting of an id wins, so the richer CMA cache is read before the old one.
  const files = [
    ['met', MET_CACHE],
    ['cma', CMA_CACHE],
    ['cma', CMA_LEGACY_CACHE],
    ['rijks', RIJKS_CACHE],
    ['nga', NGA_CACHE],
  ].filter(([src]) => sources.includes(src));

  for (const [src, file] of files) {
    let seen = 0;
    for await (const record of readRecords(file)) {
      if (!record?.o || seen >= limit) continue;
      if (file === CMA_LEGACY_CACHE && superseded(record.o)) continue;
      seen++;
      const item = normalizeArtwork(record.o, src);
      if (!item) dropped++;
      else if (!byId.has(item.id)) byId.set(item.id, item);
    }
  }
  return { items: [...byId.values()], dropped };
}

async function colorizeAll(items, log) {
  const width = Math.max(2, os.availableParallelism?.() ?? 4);
  let done = 0;
  let decodeFailed = 0;

  const colored = await pool(items, width, async (item) => {
    let result = null;
    try {
      const buf = await readCachedThumb(item.id);
      const color = await extractDominantColor(buf);
      // The map rides along only until the composition file is written; the
      // bucket writer drops it so the index does not carry nine cells per work.
      if (color) result = { ...item, ...color, c: color.neutral ? null : await extractComposition(buf) };
    } catch {
      decodeFailed++;
    }
    if (++done % 250 === 0 || done === items.length) log(`color: ${done}/${items.length}`);
    return result;
  });

  const all = colored.filter(Boolean);
  return {
    items: all.filter((i) => !i.neutral),
    neutrals: all.filter((i) => i.neutral),
    decodeFailed,
  };
}

/** Each museum's own fetch, in turn; a stop skips the rest and the index is
 *  written from whatever is cached. */
async function fetchSources(args, control, log) {
  const { sources, limit, refreshIds } = args;
  if (sources.includes('met')) {
    await fetchMetObjects({ departments: args.metDepartments, queries: args.metQueries, limit, refreshIds, control, log });
  }
  if (sources.includes('cma') && !control.stopped) {
    await fetchCmaArtworks({ types: args.cmaTypes, limit, control, log });
  }
  if (sources.includes('rijks') && !control.stopped) {
    await fetchRijksRecords({ sets: args.rijksSets, limit, control, log });
  }
  if (sources.includes('nga') && !control.stopped) {
    await fetchNgaObjects({ classes: args.ngaClasses, limit, refresh: refreshIds, control, log });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = ['npm run build:index --', ...process.argv.slice(2)].join(' ');
  // One crawl at a time: two of them raced on progress.json and public/index, twice.
  const releaseLock = await acquireLock();
  const control = createControl({ minutes: args.minutes, command, log: stamp });
  // Everything below logs through the control, so it also lands in crawl.log.
  const log = control.log;
  log(`build:index sources=${args.sources.join(',')} limit=${args.limit} minutes=${args.minutes || 'unbounded'} pid=${process.pid}`);
  log(`met departments ${args.metDepartments.join(',')} queries ${args.metQueries.join(',') || '-'}, cma types ${args.cmaTypes.join(',')}`);
  log(`rijks sets ${args.rijksSets.join(',')}, nga classes ${args.ngaClasses.join(',')}`);
  if (args.sources.length < SOURCES.length || args.limit !== Infinity) {
    log('WARNING: partial run - public/index will not be a complete index');
  }

  try {
    await fetchSources(args, control, log);

    const normalized = await normalizeAll(args);
    log(`normalized ${normalized.items.length}, dropped ${normalized.dropped} in validation`);

    const downloaded = await downloadThumbnails(normalized.items, { control, log });
    log(`thumbnails ready for ${downloaded.items.length}`);

    const colored = await colorizeAll(downloaded.items, log);
    log(`coloured ${colored.items.length}, ${colored.neutrals.length} monochrome, ${colored.decodeFailed} undecodable`);

    // Written on every run, complete or not, so the site always reflects the
    // crawl so far instead of needing all 24 hours before it is usable.
    const meta = await writeBucketFiles(
      colored.items,
      OUT_DIR,
      {
        validation: normalized.dropped,
        achromatic: 0, // no longer thrown away: they are the monochrome index
        download: downloaded.failed + colored.decodeFailed,
      },
      colored.neutrals,
    );

    log(`wrote ${OUT_DIR}`);
    await control.finish({
      stage: 'done',
      done: colored.items.length,
      total: colored.items.length,
      perMinute: null,
      minutesLeft: null,
      finished: control.stopped ? control.reason : 'complete',
    });
    if (control.stopped) log(`stopped early (${control.reason}). Resume with: ${command}`);
    console.log(JSON.stringify(meta, null, 2));
  } finally {
    control.release();
    await releaseLock();
  }
}

// A crawl that has finished must not linger on a forgotten socket, and one that
// fails must say so where it can be read back: both go through here.
process.on('unhandledRejection', (err) => {
  console.error('unhandled rejection:', err);
  process.exit(1);
});

main().then(
  () => process.exit(0),
  (err) => {
    const message = String(err?.message ?? err);
    console.error(message);
    process.exit(/another crawl is running/.test(message) ? 2 : 1);
  },
);
