import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getBuffer, head, isAbort, pool, sleep } from './http-util.mjs';

export const CACHE_DIR = path.join(import.meta.dirname, '.cache');
const MANIFEST_PATH = path.join(CACHE_DIR, 'manifest.json');
const CONCURRENCY = 5;
const CMA_COURTESY_MS = 150;

export const thumbPath = (id) => path.join(CACHE_DIR, `${id}.jpg`);

export const readCachedThumb = (id) => readFile(thumbPath(id));

async function cachedSize(id) {
  try {
    return (await stat(thumbPath(id))).size;
  } catch {
    return 0;
  }
}

async function loadManifest() {
  try {
    const parsed = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
    return { bigBytes: parsed?.bigBytes ?? {}, failed: parsed?.failed ?? {} };
  } catch {
    return { bigBytes: {}, failed: {} };
  }
}

const saveManifest = (m) => writeFile(MANIFEST_PATH, JSON.stringify(m));

/**
 * Fills `.cache/{id}.jpg` and, for Met only, `item.bigBytes` via HEAD (CMA
 * reports it in the API). Resumable: an existing non-empty cache file is never
 * re-fetched, and HEAD results persist in the manifest. A stopped `control`
 * leaves the rest on disk for the next run rather than abandoning the index,
 * and aborts whatever is in flight: five workers once sat in SYN_SENT for an
 * hour with 29 files to go, and the run could not end until they did.
 * Mutates `item.bigBytes`; returns the items whose thumbnail is on disk.
 */
export async function downloadThumbnails(items, { control, log = console.log } = {}) {
  await mkdir(CACHE_DIR, { recursive: true });
  const manifest = await loadManifest();
  const ok = [];
  let downloaded = 0;
  let cached = 0;
  let failed = 0;
  let skipped = 0;

  await pool(items, CONCURRENCY, async (item) => {
    if ((await cachedSize(item.id)) > 0) {
      cached++;
      ok.push(item);
    } else if (control?.stopped) {
      // Not on disk and no time left to fetch it: it simply misses this index.
      skipped++;
    } else {
      try {
        const fetching = getBuffer(item.thumb, { signal: control?.signal });
        const buf = await (control ? control.track(fetching) : fetching);
        if (buf.length === 0) throw new Error('empty body');
        await writeFile(thumbPath(item.id), buf);
        downloaded++;
        ok.push(item);
        if (item.src === 'cma') await sleep(CMA_COURTESY_MS);
      } catch (err) {
        if (isAbort(err)) {
          skipped++; // a pause, not a verdict: fetched next run
        } else {
          failed++;
          manifest.failed[item.id] = String(err?.message ?? err).slice(0, 200);
        }
      }
    }
    const seen = downloaded + cached + failed + skipped;
    if (seen % 250 === 0) log(`thumbs: ${seen}/${items.length}`);
    await control?.progress({ stage: 'thumbnails', done: seen, total: items.length, network: downloaded });
  });
  if (skipped) log(`thumbs: ${control.reason}, ${skipped} left for the next run`);

  const needHead = control?.stopped
    ? []
    : ok.filter((item) => item.src === 'met' && !(item.id in manifest.bigBytes));
  log(`thumbs: ${downloaded} downloaded, ${cached} cached, ${failed} failed; ${needHead.length} HEAD`);

  // Its own stage in the progress file: 45,942 HEADs at five a time is the
  // longest stretch of a warm run, and without a heartbeat here status called
  // it stalled for two hours.
  let measured = 0;
  await pool(needHead, CONCURRENCY, async (item) => {
    if (control?.stopped) return; // measured next run
    try {
      const asking = head(item.big, { signal: control?.signal });
      manifest.bigBytes[item.id] = await (control ? control.track(asking) : asking);
    } catch (err) {
      if (!isAbort(err)) throw err;
    }
    measured++;
    await control?.progress({ stage: 'sizes', done: measured, total: needHead.length, network: measured });
  });
  for (const item of ok) {
    if (item.src === 'met') item.bigBytes = manifest.bigBytes[item.id] ?? null;
  }

  await saveManifest(manifest);
  return { items: ok, downloaded, cached, failed, skipped };
}
