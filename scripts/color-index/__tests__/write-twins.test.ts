import { describe, expect, it } from 'vitest';
import { attachTwins, colourDistance, findTwins, isPrimary } from '../write-twins.mjs';
import { PAGE_SIZE, buildBuckets } from '../write-bucket-files.mjs';

const work = (id: string, src: 'met' | 'cma', hue: number, lig = 50, sat = 50, p: number[][] = []) => ({
  id, src, hue, lig, sat, pct: 0.6, p,
});

describe('isPrimary', () => {
  it('tells a work\'s own entry from a copy filed for a lesser colour', () => {
    expect(isPrimary({ pct: 0.6, p: [[210, 50, 50, 0.2]] })).toBe(true);
    // A copy wears the lesser colour's share as pct and lists the stronger one in p.
    expect(isPrimary({ pct: 0.2, p: [[30, 50, 50, 0.6]] })).toBe(false);
    expect(isPrimary({ pct: 0.6 })).toBe(true);
  });
});

describe('findTwins', () => {
  it('pairs a work with the closest colour at the other museum', () => {
    const buckets = buildBuckets([
      work('met-a', 'met', 30, 50),
      work('cma-near', 'cma', 31, 52),
      work('cma-far', 'cma', 36, 80),
    ]);
    const twins = findTwins(buckets);
    expect(twins.get('met-a')?.id).toBe('cma-near');
    expect(twins.get('cma-near')?.id).toBe('met-a');
  });

  it('never pairs a work with its own museum', () => {
    const twins = findTwins(buildBuckets([work('met-a', 'met', 30), work('met-b', 'met', 31)]));
    expect(twins.size).toBe(0);
  });

  it('records which page of the bucket the twin sits on', () => {
    const many = Array.from({ length: PAGE_SIZE + 5 }, (_, i) => ({
      ...work(`met-${i}`, 'met', 30, 50), pct: 1 - i / 1000,
    }));
    // The lone CMA work has the lowest pct, so it sorts last: onto page 1.
    const buckets = buildBuckets([...many, { ...work('cma-x', 'cma', 30, 50), pct: 0.1 }]);
    expect(findTwins(buckets).get('met-0')).toEqual({ id: 'cma-x', bucket: 2, page: 1 });
  });

  it('looks for twins among primaries only, not copies filed for a lesser colour', () => {
    // The CMA work is mostly red; its blue is a copy in bucket 14.
    const buckets = buildBuckets([
      work('met-blue', 'met', 210),
      work('cma-red', 'cma', 0, 50, 50, [[210, 50, 50, 0.2]]),
    ]);
    expect(findTwins(buckets).get('met-blue')).toBeUndefined();
  });

  it('measures distance with hue leading and the wrap at 360 respected', () => {
    expect(colourDistance({ hue: 358, lig: 50, sat: 50 }, { hue: 2, lig: 50, sat: 50 })).toBe(4);
    expect(colourDistance({ hue: 0, lig: 50, sat: 50 }, { hue: 0, lig: 60, sat: 50 })).toBe(5);
  });
});

describe('attachTwins', () => {
  it('puts the twin on every entry for the work, copies included', () => {
    const buckets = buildBuckets([
      work('met-a', 'met', 30, 50, 50, [[210, 50, 50, 0.2]]),
      work('cma-b', 'cma', 31, 50),
    ]);
    attachTwins(buckets, findTwins(buckets));
    const entries = buckets.flatMap((b) => b.items).filter((e: { id: string }) => e.id === 'met-a');
    expect(entries).toHaveLength(2);
    for (const e of entries) expect((e as { twin?: { id: string } }).twin?.id).toBe('cma-b');
  });
});
