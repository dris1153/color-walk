import { describe, expect, it } from 'vitest';
import { hueShare, signatureOf } from '../era-signature';
import type { EraRow } from '../eras-client';

const row = (id: string, counts: Record<number, number>): EraRow => {
  const h = new Array(24).fill(0);
  for (const [b, n] of Object.entries(counts)) h[Number(b)] = n;
  return { id, n: h.reduce((a, b) => a + b, 0), g: 0, h };
};

describe('signatureOf', () => {
  const ancient = row('early', { 2: 100, 13: 30 });
  const modern = row('1800', { 2: 1000, 13: 10 });
  const all = [ancient, modern];

  it('names the hue most over-represented against the whole collection, not the most common', () => {
    const sig = signatureOf(ancient, all)!;
    expect(sig.bucket).toBe(13);
    expect(sig.lift).toBeGreaterThan(5);
  });

  it('has no signature when nothing stands out, or the hue is too rare to count', () => {
    expect(signatureOf(modern, all)).toBeNull();
    expect(signatureOf(row('1', { 2: 100, 13: 5 }), [row('1', { 2: 100, 13: 5 }), modern])).toBeNull();
  });

  it('is null for an era with no coloured works', () => {
    expect(signatureOf(row('bce', {}), all)).toBeNull();
  });
});

describe('hueShare', () => {
  it('is the hue’s part of the era’s coloured works', () => {
    expect(hueShare(row('x', { 2: 75, 13: 25 }), 13)).toBe(0.25);
    expect(hueShare(row('x', {}), 13)).toBe(0);
  });
});
