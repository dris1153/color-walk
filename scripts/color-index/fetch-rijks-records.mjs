import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getBuffer, isAbort, sleep } from './http-util.mjs';
import { CACHE_DIR } from './download-thumbnails.mjs';
import { appendRecord, readIds } from './jsonl-cache.mjs';
import { parseListRecords } from './parse-edm-record.mjs';

const OAI = 'https://data.rijksmuseum.nl/oai';
const COURTESY_MS = 300;

export const RIJKS_CACHE = path.join(CACHE_DIR, 'rijks-records.jsonl');

/**
 * Curated OAI sets, chosen by measurement (2026-09-26, first 100 records of
 * each): Delftware 53% cold-hued, Dutch tin-glazed earthenware 53%, kraak
 * porcelain 73%, Middle Eastern ceramics 30%; and the paintings, which add no
 * cold hue but are what people come to the Rijksmuseum for. The two earthenware
 * sets overlap heavily; a record is cached once whichever set reaches it first.
 */
export const DEFAULT_RIJKS_SETS = ['260242', '261188', '261234', '26191', '261208'];

const firstPage = (set) => `${OAI}?verb=ListRecords&set=${encodeURIComponent(set)}&metadataPrefix=edm`;
const nextPage = (token) => `${OAI}?verb=ListRecords&resumptionToken=${encodeURIComponent(token)}`;

/**
 * Fifty works per request with image, rights and date in each record, so a set
 * of a few thousand costs a minute or two. Records are parsed on arrival and
 * cached as plain objects; a resumption token does not outlive the session, so
 * a stopped run walks the set again next time and skips what it already has.
 */
export async function fetchRijksRecords({ sets = DEFAULT_RIJKS_SETS, limit = Infinity, control, log = console.log } = {}) {
  await mkdir(CACHE_DIR, { recursive: true });
  const known = await readIds(RIJKS_CACHE);
  const before = known.size;
  let added = 0;
  let pages = 0;
  const stopped = () => {
    log(`rijks: ${control.reason} after ${added} new records`);
    return { added, cached: known.size, stopped: true };
  };

  for (const set of sets) {
    let url = firstPage(set);
    let seen = 0;
    while (url && before + added < limit) {
      if (control?.stopped) return stopped();
      let page;
      try {
        page = parseListRecords((await getBuffer(url, { signal: control?.signal })).toString('utf8'));
      } catch (err) {
        if (isAbort(err)) return stopped(); // a pause, not a failure
        // One set cut short must not cost the others, or the index: the cache
        // keeps what arrived and the next run walks this set again.
        log(`rijks: set ${set} cut short at ${seen} (${err.message}); run again to finish it`);
        break;
      }
      pages++;
      for (const record of page.records) {
        seen++;
        if (!record.id || record.deleted || known.has(record.id)) continue;
        known.add(record.id);
        await appendRecord(RIJKS_CACHE, { id: record.id, o: record });
        added++;
      }
      log(`rijks: set ${set} ${seen}/${page.size ?? '?'}, ${added} new, ${known.size} cached`);
      await control?.progress({ stage: `rijks ${set}`, done: seen, total: page.size ?? seen, network: pages });
      url = page.token ? nextPage(page.token) : null;
      if (url) await sleep(COURTESY_MS);
    }
  }
  log(`rijks: ${added} new records, ${known.size} cached in total`);
  return { added, cached: known.size, stopped: false };
}
