import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getJson, sleep } from './http-util.mjs';
import { CACHE_DIR } from './download-thumbnails.mjs';

// v1 search is deprecated from Oct 2026; v1.1 for search, v1 for objects.
// v1.1 search caps a page at 500 ids regardless of `limit`, so offset-page it.
const SEARCH_PAGE = 500;
// collectionapi.metmuseum.org sits behind Imperva, and the documented 80 req/s
// is not what the WAF enforces: measured 2026-09-13, roughly 75 requests earn a
// 403 block lasting 1-3 minutes, at 2.5 req/s as much as at 30 req/s. So this
// stage crawls sequentially, backs off when told to, and resumes from cache.
const OBJECT_DELAY_MS = 800;
const BLOCK_COOLDOWN_MS = 90_000;
const MAX_COOLDOWNS = 60;
const SAVE_EVERY = 50;
const OBJECT_CACHE = path.join(CACHE_DIR, 'met-objects.json');

const searchUrl = (offset) =>
  'https://collectionapi.metmuseum.org/public/collection/v1.1/search' +
  `?q=*&hasImages=true&isPublicDomain=true&departmentId=11&limit=${SEARCH_PAGE}&offset=${offset}`;
const objectUrl = (id) =>
  `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`;

async function loadCache() {
  try {
    const parsed = JSON.parse(await readFile(OBJECT_CACHE, 'utf8'));
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

const saveCache = (cache) => writeFile(OBJECT_CACHE, JSON.stringify(cache));

async function searchAllIds(log) {
  const ids = [];
  for (let offset = 0; ; offset += SEARCH_PAGE) {
    const page = await getJson(searchUrl(offset));
    const batch = Array.isArray(page?.objectIDs) ? page.objectIDs : [];
    ids.push(...batch);
    if (batch.length < SEARCH_PAGE) {
      log(`met: search reports ${page?.total ?? '?'} total, collected ${ids.length} ids`);
      return ids;
    }
  }
}

/**
 * No batch endpoint exists, so every object is its own request. Results are
 * cached by id, so a run that ends early resumes exactly where it stopped.
 * A cached `null` means permanently gone (404); a missing key means "retry".
 */
export async function fetchMetObjects({ limit = Infinity, log = console.log } = {}) {
  await mkdir(CACHE_DIR, { recursive: true });
  const cache = await loadCache();

  const ids = [...new Set(await searchAllIds(log))]
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, limit);
  const missing = ids.filter((id) => !(String(id) in cache));
  log(`met: ${ids.length} ids, ${ids.length - missing.length} cached, fetching ${missing.length}`);

  let done = 0;
  let gone = 0;
  let cooldowns = 0;

  for (const id of missing) {
    let settled = false;
    while (!settled) {
      try {
        cache[String(id)] = await getJson(objectUrl(id), { retries: 1 });
        settled = true;
      } catch (err) {
        if (err?.status !== 403) {
          cache[String(id)] = null; // 404 and friends: do not ask again
          gone++;
          settled = true;
        } else if (++cooldowns > MAX_COOLDOWNS) {
          await saveCache(cache);
          log(`met: still blocked after ${MAX_COOLDOWNS} cooldowns - stopping, re-run to resume`);
          return ids.map((x) => cache[String(x)]).filter((o) => o);
        } else {
          await saveCache(cache);
          log(`met: blocked, cooling down 90s (${cooldowns}/${MAX_COOLDOWNS}), ${done}/${missing.length} done`);
          await sleep(BLOCK_COOLDOWN_MS);
        }
      }
    }
    if (++done % SAVE_EVERY === 0) {
      await saveCache(cache);
      log(`met: ${done}/${missing.length}`);
    }
    await sleep(OBJECT_DELAY_MS);
  }

  await saveCache(cache);
  const objects = ids.map((id) => cache[String(id)]).filter((o) => o);
  log(`met: ${objects.length} objects available, ${gone} gone`);
  return objects;
}
