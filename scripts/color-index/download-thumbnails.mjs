import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getBuffer, head, pool, sleep } from './http-util.mjs';

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
 * re-fetched, and HEAD results persist in the manifest.
 * Mutates `item.bigBytes`; returns the items whose thumbnail is on disk.
 */
export async function downloadThumbnails(items, { log = console.log } = {}) {
  await mkdir(CACHE_DIR, { recursive: true });
  const manifest = await loadManifest();
  const ok = [];
  let downloaded = 0;
  let cached = 0;
  let failed = 0;

  await pool(items, CONCURRENCY, async (item) => {
    if ((await cachedSize(item.id)) > 0) {
      cached++;
      ok.push(item);
    } else {
      try {
        const buf = await getBuffer(item.thumb);
        if (buf.length === 0) throw new Error('empty body');
        await writeFile(thumbPath(item.id), buf);
        downloaded++;
        ok.push(item);
        if (item.src === 'cma') await sleep(CMA_COURTESY_MS);
      } catch (err) {
        failed++;
        manifest.failed[item.id] = String(err?.message ?? err).slice(0, 200);
      }
    }
    const seen = downloaded + cached + failed;
    if (seen % 250 === 0) log(`thumbs: ${seen}/${items.length}`);
  });

  const needHead = ok.filter(
    (item) => item.src === 'met' && !(item.id in manifest.bigBytes),
  );
  log(`thumbs: ${downloaded} downloaded, ${cached} cached, ${failed} failed; ${needHead.length} HEAD`);

  await pool(needHead, CONCURRENCY, async (item) => {
    manifest.bigBytes[item.id] = await head(item.big);
  });
  for (const item of ok) {
    if (item.src === 'met') item.bigBytes = manifest.bigBytes[item.id] ?? null;
  }

  await saveManifest(manifest);
  return { items: ok, downloaded, cached, failed };
}
