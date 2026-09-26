import { describe, expect, it } from 'vitest';
import { attachEchoes, buildEchoPairs, findEchoes } from '../write-echoes.mjs';

const work = (id: string, y: number | undefined, over: Record<string, unknown> = {}) => ({
  id, y, hue: 210, sat: 60, lig: 40, t: id, thumb: 'x', hex: '#336699', src: 'met', ...over,
});

describe('findEchoes', () => {
  const items = [work('faience', -1500), work('middle', 900), work('vase', 1900), work('far-hue', -2000, { hue: 30 })];

  it('pairs a work with the same colour furthest away in time, a thousand years or more', () => {
    const echoes = findEchoes(items);
    expect(echoes.get('faience')?.id).toBe('vase');
    expect(echoes.get('vase')?.id).toBe('faience');
    expect(echoes.get('middle')?.id).toBe('faience');
  });

  it('ignores other colours, undated works, and anything nearer than a thousand years', () => {
    const echoes = findEchoes([...items, work('undated', undefined), work('close', 1950, { hue: 90 }), work('close2', 1200, { hue: 90 })]);
    expect(echoes.has('far-hue')).toBe(false);
    expect(echoes.has('undated')).toBe(false);
    expect(echoes.has('close')).toBe(false);
  });
});

describe('attachEchoes', () => {
  it('puts the echo and where it lives on every entry of the work', () => {
    const buckets = [{ bucket: 14, items: [{ id: 'faience' }, { id: 'other' }] }];
    const echoes = new Map([['faience', { id: 'vase' }]]);
    attachEchoes(buckets, echoes, new Map([['vase', { bucket: 14, page: 2 }]]));
    expect(buckets[0]!.items[0]).toEqual({ id: 'faience', echo: { id: 'vase', bucket: 14, page: 2 } });
    expect(buckets[0]!.items[1]).toEqual({ id: 'other' });
  });
});

describe('buildEchoPairs', () => {
  it('keeps clearly coloured pairs at least 1,500 years apart, dealt round the wheel', () => {
    const located = new Map(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => [id, { bucket: 14, page: 0 }]));
    const pairs = buildEchoPairs(
      [
        work('a', -3000), work('b', 1900),
        work('c', -500, { hue: 120 }), work('d', 1800, { hue: 120 }),
        work('e', 1000, { hue: 300 }), work('f', 1900, { hue: 300 }),
      ],
      located,
    );
    expect(pairs.map((p) => [p.a.id, p.b.id])).toEqual([['c', 'd'], ['a', 'b']]);
    expect(pairs[1]!.a).toMatchObject({ y: -3000, bucket: 14, page: 0 });
  });
});
