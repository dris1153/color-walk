import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getJson, isAbort, sleep } from './http-util.mjs';
import { CACHE_DIR } from './download-thumbnails.mjs';
import { appendRecord, readIds } from './jsonl-cache.mjs';

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

export const MET_CACHE = path.join(CACHE_DIR, 'met-objects.jsonl');
const LEGACY_CACHE = path.join(CACHE_DIR, 'met-objects.json');
const IDS_CACHE = path.join(CACHE_DIR, 'met-ids.json');
/** European Paintings, which the first index was built from. Widen with
 *  --met-departments=11,6,14,21 (Asian, Islamic, Modern). */
export const DEFAULT_MET_DEPARTMENTS = [11];

const searchUrl = (departmentId, offset) =>
  'https://collectionapi.metmuseum.org/public/collection/v1.1/search' +
  `?q=*&hasImages=true&isPublicDomain=true&departmentId=${departmentId}` +
  `&limit=${SEARCH_PAGE}&offset=${offset}`;
const departmentUrl = (departmentId) =>
  `https://collectionapi.metmuseum.org/public/collection/v1/objects?departmentIds=${departmentId}`;
const objectUrl = (id) => `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`;

/** The pre-JSONL cache is worth hours of crawling; carry it over once. */
async function migrateLegacyCache(log) {
  let legacy;
  try {
    legacy = JSON.parse(await readFile(LEGACY_CACHE, 'utf8'));
  } catch {
    return;
  }
  const known = await readIds(MET_CACHE);
  let moved = 0;
  for (const [id, o] of Object.entries(legacy)) {
    if (known.has(id)) continue;
    await appendRecord(MET_CACHE, { id: Number(id), o });
    moved++;
  }
  if (moved) log(`met: carried ${moved} objects over from the old JSON cache`);
}

async function searchDepartment(departmentId, log, control) {
  const ids = [];
  for (let offset = 0; ; offset += SEARCH_PAGE) {
    if (control?.stopped) return { ids, complete: false };
    let page;
    try {
      page = await getJson(searchUrl(departmentId, offset), { signal: control?.signal });
    } catch (err) {
      if (isAbort(err)) return { ids, complete: false }; // a pause; not cached as complete
      throw err;
    }
    const batch = Array.isArray(page?.objectIDs) ? page.objectIDs : [];
    ids.push(...batch);
    await control?.progress({ stage: `met search ${departmentId}`, done: ids.length, total: page?.total ?? 0 });
    if (batch.length < SEARCH_PAGE) {
      log(`met: department ${departmentId} reports ${page?.total ?? '?'}, collected ${ids.length}`);
      return { ids, complete: true };
    }
    await sleep(OBJECT_DELAY_MS); // search pages count against the same WAF budget
  }
}

/**
 * The department listing: one request, no cap, every object in the department
 * whether or not it is usable. normalizeArtwork drops the rest, which measured
 * 3-15% of a department, and that waste is the price of the ids search cannot
 * reach.
 */
async function departmentObjectIds(departmentId, log, control) {
  const page = await getJson(departmentUrl(departmentId), { signal: control?.signal });
  const ids = Array.isArray(page?.objectIDs) ? page.objectIDs : [];
  log(`met: department ${departmentId} lists ${ids.length} objects`);
  return ids;
}

/**
 * Both id sources, unioned, because neither is a superset of the other:
 * measured 2026-09-14, search reports 34,217 usable works in Asian Art but
 * hands out only the first 10,000, while the department listing returns all
 * 37,320 objects it holds - and yet for European Paintings the listing has
 * 2,644 against search's 2,721. Either one alone silently loses works.
 *
 * The union costs ~21 requests per department, dead weight on a short bounded
 * run, so it is cached under the key of the departments that produced it.
 */
async function collectIds(departments, { log, control, refreshIds }) {
  const key = departments.join(',');
  if (!refreshIds) {
    try {
      const cached = JSON.parse(await readFile(IDS_CACHE, 'utf8'));
      if (cached?.key === key && Array.isArray(cached.ids)) {
        log(`met: ${cached.ids.length} ids from cache (--refresh-ids to search again)`);
        return cached.ids;
      }
    } catch {
      // no usable id cache; fall through and search
    }
  }
  const found = [];
  let complete = true;
  for (const departmentId of departments) {
    const result = await searchDepartment(departmentId, log, control);
    found.push(...result.ids);
    complete &&= result.complete;
    if (control?.stopped) break;
    try {
      found.push(...(await departmentObjectIds(departmentId, log, control)));
    } catch (err) {
      if (!isAbort(err)) throw err;
      complete = false;
      break;
    }
    await sleep(OBJECT_DELAY_MS);
  }
  const ids = [...new Set(found)].filter((id) => Number.isInteger(id) && id > 0);
  // A half-finished search must never be cached, or the next run would treat
  // the departments it never reached as already collected.
  if (complete) await writeFile(IDS_CACHE, JSON.stringify({ key, ids }));
  else log('met: search was cut short, so the id list is not cached');
  log(`met: ${ids.length} unique ids across departments ${key}`);
  return ids;
}

/**
 * No batch endpoint exists, so every object is its own request. Each result is
 * appended the moment it arrives, so a run that ends early - by Ctrl+C, by
 * --minutes, or by a WAF block - loses at most the request in flight.
 */
export async function fetchMetObjects({
  departments = DEFAULT_MET_DEPARTMENTS,
  limit = Infinity,
  refreshIds = false,
  control,
  log = console.log,
} = {}) {
  await mkdir(CACHE_DIR, { recursive: true });
  await migrateLegacyCache(log);

  const ids = (await collectIds(departments, { log, control, refreshIds })).slice(0, limit);
  const known = await readIds(MET_CACHE);
  const missing = ids.filter((id) => !known.has(String(id)));
  log(`met: ${ids.length} ids, ${ids.length - missing.length} cached, fetching ${missing.length}`);

  let done = 0;
  let gone = 0;
  let cooldowns = 0;
  const stopped = () => {
    log(`met: ${control.reason} at ${done}/${missing.length}`);
    return { fetched: done, gone, remaining: missing.length - done, stopped: true };
  };

  for (const id of missing) {
    if (control?.stopped) return stopped();
    let settled = false;
    while (!settled) {
      try {
        const o = await getJson(objectUrl(id), { retries: 1, signal: control?.signal });
        await appendRecord(MET_CACHE, { id, o });
        settled = true;
      } catch (err) {
        if (isAbort(err)) return stopped(); // a pause, not a verdict: asked for again next run
        if (err?.status !== 403) {
          await appendRecord(MET_CACHE, { id, o: null }); // 404 and friends: never ask again
          gone++;
          settled = true;
        } else if (++cooldowns > MAX_COOLDOWNS) {
          log(`met: still blocked after ${MAX_COOLDOWNS} cooldowns - stopping, re-run to resume`);
          return { fetched: done, gone, remaining: missing.length - done, stopped: true };
        } else {
          log(`met: blocked, cooling down 90s (${cooldowns}/${MAX_COOLDOWNS}), ${done}/${missing.length} done`);
          if (control) await control.wait(BLOCK_COOLDOWN_MS);
          else await sleep(BLOCK_COOLDOWN_MS);
        }
      }
    }
    done++;
    await control?.progress({ stage: 'met objects', done, total: missing.length, network: done });
    await sleep(OBJECT_DELAY_MS);
  }

  log(`met: ${done} fetched this run, ${gone} gone`);
  return { fetched: done, gone, remaining: 0, stopped: false };
}
