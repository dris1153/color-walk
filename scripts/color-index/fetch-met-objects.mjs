import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { getJson, isAbort, sleep } from './http-util.mjs';
import { CACHE_DIR } from './download-thumbnails.mjs';
import { appendRecord, readIds } from './jsonl-cache.mjs';
import { OBJECT_DELAY_MS, collectIds } from './collect-met-ids.mjs';

// The Imperva WAF in front of the Met refuses bursts (see collect-met-ids.mjs),
// so objects are fetched one at a time and a refusal earns a cooldown.
const BLOCK_COOLDOWN_MS = 90_000;
const MAX_COOLDOWNS = 60;

export const MET_CACHE = path.join(CACHE_DIR, 'met-objects.jsonl');
const LEGACY_CACHE = path.join(CACHE_DIR, 'met-objects.json');
/** European Paintings, which the first index was built from. Widen with
 *  --met-departments=11,6,14,21 (Asian, Islamic, Modern). */
export const DEFAULT_MET_DEPARTMENTS = [11];

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

/**
 * No batch endpoint exists, so every object is its own request. Each result is
 * appended the moment it arrives, so a run that ends early - by Ctrl+C, by
 * --minutes, or by a WAF block - loses at most the request in flight.
 */
export async function fetchMetObjects({
  departments = DEFAULT_MET_DEPARTMENTS,
  queries = [],
  limit = Infinity,
  refreshIds = false,
  control,
  log = console.log,
} = {}) {
  await mkdir(CACHE_DIR, { recursive: true });
  await migrateLegacyCache(log);

  const ids = (await collectIds(departments, queries, { log, control, refreshIds })).slice(0, limit);
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
