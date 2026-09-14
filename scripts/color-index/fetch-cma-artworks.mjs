import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getJson, sleep } from './http-util.mjs';
import { CACHE_DIR } from './download-thumbnails.mjs';
import { appendRecord, readIds } from './jsonl-cache.mjs';

const PAGE_SIZE = 1000;
const COURTESY_MS = 150;
/** `skip` paging over a live result set drops records: measured 2026-09-14,
 *  a pass over 3,957 CC0 paintings returns 3,956 distinct ids, and `sort` is
 *  accepted but ignored, so there is no stable order to page. One repeat pass
 *  catches a record the shuffle moved; four passes did not close the last of
 *  the gap, so the residual is logged rather than chased. The JSONL cache is
 *  the real remedy: anything ever seen stays seen. */
const MAX_PASSES = 2;
const FIELDS = [
  'id',
  'title',
  'creators',
  'creation_date',
  'images',
  'type',
  'url',
  'accession_number',
  'creditline',
  'share_license_status',
].join(',');

export const CMA_CACHE = path.join(CACHE_DIR, 'cma-artworks.jsonl');
/** What the first index was built from. Widen with --cma-types=all. */
export const DEFAULT_CMA_TYPES = ['Painting'];

const pageUrl = (type, skip) =>
  'https://openaccess-api.clevelandart.org/api/artworks/' +
  `?cc0=1&has_image=1&limit=${PAGE_SIZE}&skip=${skip}&fields=${FIELDS}` +
  (type === 'all' ? '' : `&type=${encodeURIComponent(type)}`);

/**
 * Cheap enough to re-run, but cached to JSONL all the same so that a crawl
 * bounded by --minutes spends its time on the Met rather than re-reading a
 * museum's whole catalogue every session.
 */
export async function fetchCmaArtworks({
  types = DEFAULT_CMA_TYPES,
  limit = Infinity,
  control,
  log = console.log,
} = {}) {
  await mkdir(CACHE_DIR, { recursive: true });
  const known = await readIds(CMA_CACHE);
  const before = known.size;
  let added = 0;

  for (const type of types) {
    let total = Infinity;
    for (let pass = 1; pass <= MAX_PASSES; pass++) {
      const seen = new Set();
      for (let skip = 0; before + added < limit; skip += PAGE_SIZE) {
        if (control?.stopped) {
          log(`cma: ${control.reason} after ${added} new records`);
          return { added, cached: known.size, stopped: true };
        }
        const res = await getJson(pageUrl(type, skip));
        const data = Array.isArray(res?.data) ? res.data : [];
        if (Number.isFinite(res?.info?.total)) total = res.info.total;
        for (const record of data) {
          if (record?.id == null) continue;
          seen.add(String(record.id));
          if (known.has(String(record.id))) continue;
          known.add(String(record.id));
          await appendRecord(CMA_CACHE, { id: record.id, o: record });
          added++;
        }
        log(`cma: ${type} pass ${pass} skip=${skip}, ${added} new, ${known.size} cached`);
        await control?.progress({ stage: `cma ${type}`, done: known.size, total });
        if (data.length < PAGE_SIZE) break;
        await sleep(COURTESY_MS);
      }
      if (seen.size >= total || before + added >= limit) break;
      if (pass < MAX_PASSES) log(`cma: ${type} saw ${seen.size} of ${total}; paging again for the rest`);
      else log(`cma: ${type} saw ${seen.size} of ${total}; the API did not serve the rest`);
    }
  }

  log(`cma: ${added} new records, ${known.size} cached in total`);
  return { added, cached: known.size, stopped: false };
}
