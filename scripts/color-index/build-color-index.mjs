#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';
import { pool } from './http-util.mjs';
import { fetchMetObjects } from './fetch-met-objects.mjs';
import { fetchCmaArtworks } from './fetch-cma-artworks.mjs';
import { normalizeArtwork } from './normalize-artwork.mjs';
import { downloadThumbnails, readCachedThumb } from './download-thumbnails.mjs';
import { extractDominantColor } from './extract-dominant-color.mjs';
import { writeBucketFiles } from './write-bucket-files.mjs';

const OUT_DIR = path.join(import.meta.dirname, '..', '..', 'public', 'index');
const started = Date.now();
const log = (msg) => {
  const s = String(Math.round((Date.now() - started) / 1000)).padStart(4);
  console.log(`[${s}s] ${msg}`);
};

function parseArgs(argv) {
  let source = 'both';
  let limit = Infinity;
  for (const arg of argv) {
    const m = /^--(source|limit)=(.+)$/.exec(arg);
    if (!m) continue;
    if (m[1] === 'source') source = m[2];
    else limit = Number(m[2]);
  }
  if (!['both', 'met', 'cma'].includes(source)) throw new Error(`bad --source=${source}`);
  if (!(limit > 0)) throw new Error('--limit must be a positive number');
  return { source, limit };
}

async function collectRaw({ source, limit }) {
  const raw = [];
  if (source !== 'cma') {
    for (const o of await fetchMetObjects({ limit, log })) raw.push([o, 'met']);
  }
  if (source !== 'met') {
    for (const o of await fetchCmaArtworks({ limit, log })) raw.push([o, 'cma']);
  }
  return raw;
}

function normalizeAll(raw) {
  const byId = new Map();
  let dropped = 0;
  for (const [record, src] of raw) {
    const item = normalizeArtwork(record, src);
    if (!item) dropped++;
    else if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return { items: [...byId.values()], dropped };
}

async function colorizeAll(items) {
  const width = Math.max(2, os.availableParallelism?.() ?? 4);
  let done = 0;
  let achromatic = 0;
  let decodeFailed = 0;

  const colored = await pool(items, width, async (item) => {
    let result = null;
    try {
      const color = await extractDominantColor(await readCachedThumb(item.id));
      if (color) result = { ...item, ...color };
      else achromatic++;
    } catch {
      decodeFailed++;
    }
    if (++done % 250 === 0 || done === items.length) log(`color: ${done}/${items.length}`);
    return result;
  });

  return { items: colored.filter(Boolean), achromatic, decodeFailed };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  log(`build:index source=${args.source} limit=${args.limit}`);
  if (args.source !== 'both' || args.limit !== Infinity) {
    log('WARNING: partial run - public/index will not be a complete index');
  }

  const raw = await collectRaw(args);
  log(`fetched ${raw.length} raw records`);

  const normalized = normalizeAll(raw);
  log(`normalized ${normalized.items.length}, dropped ${normalized.dropped} in validation`);

  const downloaded = await downloadThumbnails(normalized.items, { log });
  log(`thumbnails ready for ${downloaded.items.length}`);

  const colored = await colorizeAll(downloaded.items);
  log(`coloured ${colored.items.length}, ${colored.achromatic} achromatic, ${colored.decodeFailed} undecodable`);

  const meta = await writeBucketFiles(colored.items, OUT_DIR, {
    validation: normalized.dropped,
    achromatic: colored.achromatic,
    download: downloaded.failed + colored.decodeFailed,
  });

  log(`wrote ${OUT_DIR}`);
  console.log(JSON.stringify(meta, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
