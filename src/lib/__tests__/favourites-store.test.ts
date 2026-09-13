import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FAVOURITES_MAX,
  readFavourites,
  toggleIn,
  writeFavourites,
} from '../favourites-store';
import type { Item } from '../color-index-client';

const item = (id: string, over: Partial<Item> = {}): Item => ({
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
  sat: 40,
  lig: 50,
  hex: '#a6784b',
  pct: 0.5,
  page: `https://clevelandart.org/art/${id}`,
  credit: 'A credit line',
  ...over,
});

function useStore(initial: string | null, failing = false) {
  const data = new Map<string, string>();
  if (initial !== null) data.set('cw:favourites', initial);
  const store = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (failing) throw new DOMException('QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
  vi.stubGlobal('localStorage', store);
  return data;
}

afterEach(() => vi.unstubAllGlobals());

describe('readFavourites', () => {
  it('round-trips what was written', () => {
    useStore(null);
    writeFavourites([item('1915.534'), item('1922.1132')]);
    expect(readFavourites().map((i) => i.id)).toEqual(['1915.534', '1922.1132']);
  });

  it('drops an entry pointing at a foreign image host', () => {
    useStore(JSON.stringify([item('a', { thumb: 'https://evil.example/x.jpg' }), item('b')]));
    expect(readFavourites().map((i) => i.id)).toEqual(['b']);
  });

  it('drops an entry pointing at a foreign museum page', () => {
    useStore(JSON.stringify([item('a', { page: 'https://evil.example/art/1' }), item('b')]));
    expect(readFavourites().map((i) => i.id)).toEqual(['b']);
  });

  it('drops an entry with a malformed hex, which would reach an inline style', () => {
    useStore(JSON.stringify([item('a', { hex: 'red; background:url(x)' }), item('b')]));
    expect(readFavourites().map((i) => i.id)).toEqual(['b']);
  });

  it('returns an empty list for malformed JSON rather than throwing', () => {
    useStore('{not json');
    expect(readFavourites()).toEqual([]);
  });

  it('returns an empty list when the stored value is not an array', () => {
    useStore('{"a":1}');
    expect(readFavourites()).toEqual([]);
  });

  it('returns an empty list when storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(readFavourites()).toEqual([]);
  });
});

describe('writeFavourites', () => {
  it('swallows a quota failure instead of breaking the page', () => {
    useStore(null, true);
    expect(() => writeFavourites([item('a')])).not.toThrow();
  });

  it('never persists more than the cap', () => {
    const data = useStore(null);
    writeFavourites(Array.from({ length: 250 }, (_, i) => item(`x${i}`)));
    expect(JSON.parse(data.get('cw:favourites') ?? '[]')).toHaveLength(FAVOURITES_MAX);
  });
});

describe('toggleIn', () => {
  it('adds a new work at the front', () => {
    expect(toggleIn([item('a')], item('b')).map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('removes a work that is already saved', () => {
    expect(toggleIn([item('a'), item('b')], item('a')).map((i) => i.id)).toEqual(['b']);
  });

  it('drops the oldest once the cap is reached', () => {
    const full = Array.from({ length: FAVOURITES_MAX }, (_, i) => item(`x${i}`));
    const next = toggleIn(full, item('new'));
    expect(next).toHaveLength(FAVOURITES_MAX);
    expect(next[0]?.id).toBe('new');
    expect(next.some((i) => i.id === `x${FAVOURITES_MAX - 1}`)).toBe(false);
  });

  it('does not mutate its input', () => {
    const list = [item('a')];
    toggleIn(list, item('b'));
    expect(list.map((i) => i.id)).toEqual(['a']);
  });
});
