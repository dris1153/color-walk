import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasMorePages, isItem, loadBucketPage, loadBucketNear, loadSpine, type Item } from '../color-index-client';

const item = (id: string): Item => ({
  id,
  src: 'cma',
  t: 'A work',
  a: 'An artist',
  d: '1873',
  w: 800,
  h: 600,
  thumb: `https://openaccess-cdn.clevelandart.org/${id}/${id}_web.jpg`,
  big: `https://openaccess-cdn.clevelandart.org/${id}/${id}_print.jpg`,
  bigBytes: 1000,
  hue: 30,
  sat: 60,
  lig: 45,
  hex: '#b37a33',
  pct: 0.4,
  page: 'https://www.clevelandart.org/art/1',
  credit: 'CC0',
});

/** Every bucket here is a fresh number, because the module cache is by design
 * process-wide and shared between tests. */
const serve = (bodies: Record<string, unknown>) => {
  const seen: string[] = [];
  vi.stubGlobal('fetch', (url: string) => {
    seen.push(url);
    const body = bodies[url];
    if (body === undefined) return Promise.resolve({ ok: false } as Response);
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
  });
  return seen;
};

/** At least MIN_ITEMS, or loadBucketNear pads from neighbours nobody served. */
const full = (prefix: string) => Array.from({ length: 60 }, (_, i) => item(`${prefix}${i}`));

afterEach(() => vi.unstubAllGlobals());

describe('paged bucket files', () => {
  it('reads the page count off page 0 and fetches overflow pages by name', async () => {
    const seen = serve({
      '/index/bucket-05.json': { bucket: 5, count: 1400, pages: 3, items: full('a') },
      '/index/bucket-05-1.json': { bucket: 5, page: 1, items: [item('b')] },
    });

    // Before anything is loaded the page count is unknown, so nothing is claimed.
    expect(hasMorePages(5, 1)).toBe(false);

    await loadBucketNear(5);
    expect(hasMorePages(5, 1)).toBe(true);
    expect(hasMorePages(5, 3)).toBe(false);

    const page1 = await loadBucketPage(5, 1);
    expect(page1.map((i) => i.id)).toEqual(['b']);
    expect(seen).toContain('/index/bucket-05-1.json');
  });

  it('treats a bucket that declares no pages as a single page', async () => {
    serve({ '/index/bucket-06.json': { bucket: 6, count: 3, items: full('c') } });
    await loadBucketNear(6);
    expect(hasMorePages(6, 1)).toBe(false);
  });

  it('never pages all.json', async () => {
    serve({ '/index/all.json': { pages: 9, items: full('d') } });
    await loadBucketNear(null);
    expect(hasMorePages(null, 1)).toBe(false);
  });

  it('fetches each page at most once', async () => {
    const seen = serve({
      '/index/bucket-07.json': { bucket: 7, count: 700, pages: 2, items: full('e') },
      '/index/bucket-07-1.json': { bucket: 7, page: 1, items: [item('f')] },
    });
    await loadBucketPage(7, 0);
    await loadBucketPage(7, 1);
    await loadBucketPage(7, 1);
    expect(seen.filter((u) => u === '/index/bucket-07-1.json')).toHaveLength(1);
  });
});

describe('the spine', () => {
  it('fetches once and keeps it for the session', async () => {
    const seen = serve({ '/index/spine.json': { count: 60, items: full('s') } });
    const first = await loadSpine();
    const second = await loadSpine();
    expect(first).toBe(second);
    expect(seen.filter((u) => u === '/index/spine.json')).toHaveLength(1);
  });

  it('drops anything in it that does not survive validation', async () => {
    vi.resetModules();
    const fresh = await import('../color-index-client');
    serve({ '/index/spine.json': { count: 2, items: [item('ok'), { id: 'bad', hue: 999 }] } });
    expect((await fresh.loadSpine()).map((i) => i.id)).toEqual(['ok']);
  });
});

describe('loadTwin', () => {
  it('finds the twin on the page the index named, fetching it at most once', async () => {
    vi.resetModules();
    const fresh = await import('../color-index-client');
    const seen = serve({
      '/index/bucket-09.json': { bucket: 9, count: 700, pages: 2, items: full('p') },
      '/index/bucket-09-1.json': { bucket: 9, page: 1, items: [item('twin-here')] },
    });
    const twin = { id: 'twin-here', bucket: 9, page: 1 };
    expect((await fresh.loadTwin(twin))?.id).toBe('twin-here');
    expect((await fresh.loadTwin(twin))?.id).toBe('twin-here');
    expect(seen.filter((u) => u === '/index/bucket-09-1.json')).toHaveLength(1);
  });

  it('returns nothing rather than a wrong work when the page disagrees with the index', async () => {
    vi.resetModules();
    const fresh = await import('../color-index-client');
    serve({ '/index/bucket-10.json': { bucket: 10, count: 1, pages: 1, items: full('q') } });
    expect(await fresh.loadTwin({ id: 'nobody', bucket: 10, page: 0 })).toBeNull();
  });
});

describe('isItem - the twin field', () => {
  it('accepts a sound twin and rejects a broken one', () => {
    const base = item('t');
    expect(isItem({ ...base, twin: { id: 'x', bucket: 3, page: 0 } })).toBe(true);
    expect(isItem({ ...base, twin: { id: 'x', bucket: 24, page: 0 } })).toBe(false);
    expect(isItem({ ...base, twin: { id: 'x', bucket: 3, page: -1 } })).toBe(false);
    expect(isItem({ ...base, twin: { id: 42, bucket: 3, page: 0 } })).toBe(false);
    expect(isItem({ ...base, twin: 'x' })).toBe(false);
  });
});
