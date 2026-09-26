import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getJson, isAbort, sleep } from './http-util.mjs';
import { CACHE_DIR } from './download-thumbnails.mjs';

// v1 search is deprecated from Oct 2026; v1.1 for search, v1 for objects.
// v1.1 search caps a page at 500 ids regardless of `limit`, so offset-page it.
const SEARCH_PAGE = 500;
/** The search stops serving ids past this offset, whatever total it reports. */
const SEARCH_CAP = 10_000;
// collectionapi.metmuseum.org sits behind Imperva, and the documented 80 req/s
// is not what the WAF enforces: measured 2026-09-13, roughly 75 requests earn a
// 403 block lasting 1-3 minutes, at 2.5 req/s as much as at 30 req/s.
export const OBJECT_DELAY_MS = 800;

const IDS_CACHE = path.join(CACHE_DIR, 'met-ids.json');

const SEARCH = 'https://collectionapi.metmuseum.org/public/collection/v1.1/search';
const departmentSearchUrl = (departmentId, offset) =>
  `${SEARCH}?q=*&hasImages=true&isPublicDomain=true&departmentId=${departmentId}&limit=${SEARCH_PAGE}&offset=${offset}`;
const querySearchUrl = (query, offset) =>
  `${SEARCH}?q=${encodeURIComponent(query)}&hasImages=true&isPublicDomain=true&limit=${SEARCH_PAGE}&offset=${offset}`;
const departmentUrl = (departmentId) =>
  `https://collectionapi.metmuseum.org/public/collection/v1/objects?departmentIds=${departmentId}`;

async function search(label, urlAt, log, control) {
  const ids = [];
  for (let offset = 0; offset < SEARCH_CAP; offset += SEARCH_PAGE) {
    if (control?.stopped) return { ids, complete: false };
    let page;
    try {
      page = await getJson(urlAt(offset), { signal: control?.signal });
    } catch (err) {
      if (isAbort(err)) return { ids, complete: false }; // a pause; not cached as complete
      throw err;
    }
    const batch = Array.isArray(page?.objectIDs) ? page.objectIDs : [];
    ids.push(...batch);
    await control?.progress({ stage: `met search ${label}`, done: ids.length, total: page?.total ?? 0 });
    if (batch.length < SEARCH_PAGE) {
      log(`met: ${label} reports ${page?.total ?? '?'}, collected ${ids.length}`);
      return { ids, complete: true };
    }
    await sleep(OBJECT_DELAY_MS); // search pages count against the same WAF budget
  }
  log(`met: ${label} stops at the search cap of ${SEARCH_CAP}`);
  return { ids, complete: true };
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
 * Both id sources for a department, unioned, because neither is a superset of
 * the other: measured 2026-09-14, search reports 34,217 usable works in Asian
 * Art but hands out only the first 10,000, while the department listing returns
 * all 37,320 objects it holds - and yet for European Paintings the listing has
 * 2,644 against search's 2,721. Either one alone silently loses works.
 *
 * Keyword queries reach across departments for materials the wheel lacks:
 * turquoise, faience and enamel measured 46%, 42% and 14% cold-hued, against
 * 0-5% for most departments. A query gets the search only; it has no listing.
 *
 * The union costs ~21 requests per department, dead weight on a short bounded
 * run, so it is cached under the key of what produced it.
 */
export async function collectIds(departments, queries, { log, control, refreshIds }) {
  const key = [departments.join(','), ...queries.map((q) => `q=${q}`)].join('|');
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
    const result = await search(`department ${departmentId}`, (o) => departmentSearchUrl(departmentId, o), log, control);
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
  for (const query of queries) {
    if (control?.stopped) break;
    const result = await search(`"${query}"`, (o) => querySearchUrl(query, o), log, control);
    found.push(...result.ids);
    complete &&= result.complete;
    await sleep(OBJECT_DELAY_MS);
  }
  const ids = [...new Set(found)].filter((id) => Number.isInteger(id) && id > 0);
  // A half-finished search must never be cached, or the next run would treat
  // the departments it never reached as already collected.
  if (complete && !control?.stopped) await writeFile(IDS_CACHE, JSON.stringify({ key, ids }));
  else log('met: search was cut short, so the id list is not cached');
  log(`met: ${ids.length} unique ids for ${key}`);
  return ids;
}
