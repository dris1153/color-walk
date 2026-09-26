import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { isAbort } from './http-util.mjs';
import { CACHE_DIR } from './download-thumbnails.mjs';
import { appendRecord, readIds } from './jsonl-cache.mjs';
import { csvFile } from './csv-rows.mjs';

const RAW = 'https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data/';
const CSV_DIR = path.join(CACHE_DIR, 'nga');
/** ~215 MB across four files; ten minutes is generous and still a deadline. */
const DOWNLOAD_TIMEOUT_MS = 600_000;

export const NGA_CACHE = path.join(CACHE_DIR, 'nga-objects.jsonl');
/**
 * Measured 2026-09-26: 200 random open-access works were 97% warm-hued, and 60%
 * of the collection is prints and drawings on paper. Paintings and sculpture
 * are what the gallery adds that the index lacks, so those are the default.
 */
export const DEFAULT_NGA_CLASSES = ['Painting', 'Sculpture', 'Decorative Art'];

async function download(name, { refresh, signal, log }) {
  const file = path.join(CSV_DIR, name);
  if (existsSync(file) && !refresh) return file;
  const timeout = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS);
  const res = await fetch(RAW + name, { signal: signal ? AbortSignal.any([timeout, signal]) : timeout });
  if (!res.ok || !res.body) throw new Error(`nga: ${name} answered ${res.status}`);
  // Written beside the target and renamed, so a stopped download never passes for a whole file.
  await pipeline(Readable.fromWeb(res.body), createWriteStream(`${file}.part`));
  await rename(`${file}.part`, file);
  log(`nga: downloaded ${name}`);
  return file;
}

/**
 * The gallery publishes its catalogue as CSV on GitHub, no key and no rate
 * limit, so the whole stage is four downloads and a join: the primary open-access
 * image of each work, its first listed artist and that artist's nationality.
 */
export async function fetchNgaObjects({ classes = DEFAULT_NGA_CLASSES, limit = Infinity, refresh = false, control, log = console.log } = {}) {
  await mkdir(CSV_DIR, { recursive: true });
  const opts = { refresh, signal: control?.signal, log };
  let files;
  try {
    files = {};
    for (const name of ['objects.csv', 'published_images.csv', 'objects_constituents.csv', 'constituents.csv']) {
      if (control?.stopped) break;
      files[name] = await download(name, opts);
    }
  } catch (err) {
    if (isAbort(err)) files = null; // a pause: downloaded again next run
    else throw err;
  }
  if (!files || control?.stopped) {
    log(`nga: ${control?.reason ?? 'stopped'} before the catalogue was complete`);
    return { added: 0, stopped: true };
  }

  const images = new Map();
  for await (const r of csvFile(files['published_images.csv'])) {
    if (r.viewtype === 'primary' && r.openaccess === '1') images.set(r.depictstmsobjectid, r);
  }
  const artistOf = new Map();
  for await (const r of csvFile(files['objects_constituents.csv'])) {
    if (r.roletype !== 'artist') continue;
    const current = artistOf.get(r.objectid);
    if (!current || Number(r.displayorder) < Number(current.displayorder)) artistOf.set(r.objectid, r);
  }
  const nationality = new Map();
  for await (const r of csvFile(files['constituents.csv'])) nationality.set(r.constituentid, r.nationality);

  const wanted = new Set(classes);
  const known = await readIds(NGA_CACHE);
  let added = 0;
  for await (const o of csvFile(files['objects.csv'])) {
    if (known.size >= limit) break;
    if (!wanted.has(o.classification) || o.accessioned !== '1' || o.isvirtual !== '0') continue;
    const image = images.get(o.objectid);
    if (!image || known.has(o.objectid)) continue;
    known.add(o.objectid);
    const artist = artistOf.get(o.objectid);
    await appendRecord(NGA_CACHE, {
      id: o.objectid,
      o: {
        objectid: o.objectid,
        title: o.title,
        attribution: o.attribution,
        displaydate: o.displaydate,
        beginyear: o.beginyear,
        endyear: o.endyear,
        medium: o.medium,
        classification: o.classification,
        creditline: o.creditline,
        iiifurl: image.iiifurl,
        nationality: artist ? (nationality.get(artist.constituentid) ?? '') : '',
      },
    });
    added++;
  }
  log(`nga: ${added} new works, ${known.size} cached in total`);
  await control?.progress({ stage: 'nga', done: known.size, total: known.size, network: 4 });
  return { added, stopped: false };
}
