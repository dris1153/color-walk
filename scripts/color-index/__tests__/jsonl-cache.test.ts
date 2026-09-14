import { mkdtemp, readFile, rm, writeFile, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appendRecord, readIds, readRecords } from '../jsonl-cache.mjs';

let dir: string;
const file = () => path.join(dir, 'cache.jsonl');

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'jsonl-cache-'));
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const collect = async (f: string) => {
  const out: unknown[] = [];
  for await (const record of readRecords(f)) out.push(record);
  return out;
};

describe('jsonl cache', () => {
  it('round-trips appended records', async () => {
    await appendRecord(file(), { id: 1, o: { title: 'One' } });
    await appendRecord(file(), { id: 2, o: null });
    expect(await collect(file())).toEqual([
      { id: 1, o: { title: 'One' } },
      { id: 2, o: null },
    ]);
    // A cached `null` still counts as known, or a gone object is asked for forever.
    expect([...(await readIds(file()))]).toEqual(['1', '2']);
  });

  it('drops a line torn by a kill and keeps everything before it', async () => {
    const torn = path.join(dir, 'torn.jsonl');
    await writeFile(torn, '{"id":1,"o":{"title":"One"}}\n{"id":2,"o":{"title":"Tw');
    expect(await collect(torn)).toEqual([{ id: 1, o: { title: 'One' } }]);
    expect([...(await readIds(torn))]).toEqual(['1']);

    // And the next run appends past the damage without tripping over it again.
    await appendFile(torn, '\n');
    await appendRecord(torn, { id: 3, o: { title: 'Three' } });
    expect([...(await readIds(torn))]).toEqual(['1', '3']);
  });

  it('treats a cache that does not exist yet as empty', async () => {
    expect([...(await readIds(path.join(dir, 'nothing.jsonl')))]).toEqual([]);
  });

  it('never rewrites what it has already written', async () => {
    const grow = path.join(dir, 'grow.jsonl');
    await appendRecord(grow, { id: 1, o: { title: 'One' } });
    const first = await readFile(grow, 'utf8');
    await appendRecord(grow, { id: 2, o: { title: 'Two' } });
    expect((await readFile(grow, 'utf8')).startsWith(first)).toBe(true);
  });
});
