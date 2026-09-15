#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';
import { pool } from './http-util.mjs';
import { createControl } from './crawl-control.mjs';
import { readRecords } from './jsonl-cache.mjs';
import { DEFAULT_MET_DEPARTMENTS, MET_CACHE, fetchMetObjects } from './fetch-met-objects.mjs';
import { CMA_CACHE, DEFAULT_CMA_TYPES, fetchCmaArtworks } from './fetch-cma-artworks.mjs';
import { normalizeArtwork } from './normalize-artwork.mjs';
import { downloadThumbnails, readCachedThumb } from './download-thumbnails.mjs';
import { extractDominantColor } from './extract-dominant-color.mjs';
import { extractComposition } from './extract-composition.mjs';
import { writeBucketFiles } from './write-bucket-files.mjs';

const OUT_DIR = path.join(import.meta.dirname, '..', '..', 'public', 'index');
const started = Date.now();
const log = (msg) => {
  const s = String(Math.round((Date.now() - started) / 1000)).padStart(4);
  console.log(`[${s}s] ${msg}`);
};

const numberList = (value) => value.split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);

function parseArgs(argv) {
  const args = {
    source: 'both',
    limit: Infinity,
    metDepartments: DEFAULT_MET_DEPARTMENTS,
    cmaTypes: DEFAULT_CMA_TYPES,
    minutes: 0,
    refreshIds: argv.includes('--refresh-ids'),
  };
  for (const arg of argv) {
    const m = /^--([a-z-]+)=(.+)$/.exec(arg);
    if (!m) continue;
    if (m[1] === 'source') args.source = m[2];
    else if (m[1] === 'limit') args.limit = Number(m[2]);
    else if (m[1] === 'minutes') args.minutes = Number(m[2]);
    else if (m[1] === 'met-departments') args.metDepartments = numberList(m[2]);
    else if (m[1] === 'cma-types') args.cmaTypes = m[2].split(',').filter(Boolean);
  }
  if (!['both', 'met', 'cma'].includes(args.source)) throw new Error(`bad --source=${args.source}`);
  if (!(args.limit > 0)) throw new Error('--limit must be a positive number');
  if (!(args.minutes >= 0)) throw new Error('--minutes must be a positive number');
  if (args.metDepartments.length === 0) throw new Error('--met-departments must list department ids');
  return args;
}

/**
 * Streams the raw caches rather than loading them: at 60k Met objects the
 * combined raw JSON is ~148 MB, and only the normalised item is worth keeping.
 */
async function normalizeAll({ source, limit }) {
  const byId = new Map();
  let dropped = 0;
  const files = [
    ['met', MET_CACHE],
    ['cma', CMA_CACHE],
  ].filter(([src]) => source === 'both' || source === src);

  for (const [src, file] of files) {
    let seen = 0;
    for await (const record of readRecords(file)) {
      if (!record?.o || seen >= limit) continue;
      seen++;
      const item = normalizeArtwork(record.o, src);
      if (!item) dropped++;
      else if (!byId.has(item.id)) byId.set(item.id, item);
    }
  }
  return { items: [...byId.values()], dropped };
}

async function colorizeAll(items) {
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = ['npm run build:index --', ...process.argv.slice(2)].join(' ');
  const control = createControl({ minutes: args.minutes, command, log: console.log });
  log(`build:index source=${args.source} limit=${args.limit} minutes=${args.minutes || 'unbounded'}`);
  log(`met departments ${args.metDepartments.join(',')}, cma types ${args.cmaTypes.join(',')}`);
  if (args.source !== 'both' || args.limit !== Infinity) {
    log('WARNING: partial run - public/index will not be a complete index');
  }

  try {
    if (args.source !== 'cma') {
      await fetchMetObjects({
        departments: args.metDepartments,
        limit: args.limit,
        refreshIds: args.refreshIds,
        control,
        log,
      });
    }
    if (args.source !== 'met') {
      await fetchCmaArtworks({ types: args.cmaTypes, limit: args.limit, control, log });
    }

    const normalized = await normalizeAll(args);
    log(`normalized ${normalized.items.length}, dropped ${normalized.dropped} in validation`);

    const downloaded = await downloadThumbnails(normalized.items, { control, log });
    log(`thumbnails ready for ${downloaded.items.length}`);

    const colored = await colorizeAll(downloaded.items);
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
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
