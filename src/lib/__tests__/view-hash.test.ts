import { describe, expect, it } from 'vitest';
import { formatViewHash, parseViewHash } from '../view-hash';

describe('parseViewHash - v1 forms must keep working', () => {
  it('reads a bare hue', () => {
    expect(parseViewHash('#h=212')).toEqual({ hue: 212, tone: null });
  });

  it('reads the all-colours marker', () => {
    expect(parseViewHash('#h=all')).toEqual({ hue: null, tone: null });
  });

  it('clamps and rounds out-of-range hues', () => {
    expect(parseViewHash('#h=999').hue).toBe(359);
    expect(parseViewHash('#h=-40').hue).toBe(0);
    expect(parseViewHash('#h=212.6').hue).toBe(213);
  });

  it('treats junk as no hue', () => {
    expect(parseViewHash('#h=abc')).toEqual({ hue: null, tone: null });
    expect(parseViewHash('')).toEqual({ hue: null, tone: null });
    expect(parseViewHash('#')).toEqual({ hue: null, tone: null });
    expect(parseViewHash('#nonsense')).toEqual({ hue: null, tone: null });
  });
});

describe('parseViewHash - the new tone parameter', () => {
  it('reads hue and tone together', () => {
    expect(parseViewHash('#h=212&l=30')).toEqual({ hue: 212, tone: 30 });
  });

  it('reads a tone with no hue as all-colours plus tone', () => {
    expect(parseViewHash('#l=30')).toEqual({ hue: null, tone: 30 });
    expect(parseViewHash('#h=all&l=80')).toEqual({ hue: null, tone: 80 });
  });

  it('clamps tone into 0..100', () => {
    expect(parseViewHash('#l=-5').tone).toBe(0);
    expect(parseViewHash('#l=500').tone).toBe(100);
  });

  it('treats junk tone as no tone', () => {
    expect(parseViewHash('#h=212&l=abc')).toEqual({ hue: 212, tone: null });
  });
});

describe('formatViewHash', () => {
  it('writes exactly what v1 wrote when there is no tone', () => {
    expect(formatViewHash({ hue: 212, tone: null })).toBe('#h=212');
    expect(formatViewHash({ hue: null, tone: null })).toBe('#h=all');
  });

  it('appends the tone only when one is set', () => {
    expect(formatViewHash({ hue: 212, tone: 30 })).toBe('#h=212&l=30');
    expect(formatViewHash({ hue: null, tone: 0 })).toBe('#h=all&l=0');
  });

  it('round-trips every combination', () => {
    for (const view of [
      { hue: 212, tone: null },
      { hue: null, tone: null },
      { hue: 0, tone: 0 },
      { hue: 359, tone: 100 },
      { hue: null, tone: 45 },
    ]) {
      expect(parseViewHash(formatViewHash(view))).toEqual(view);
    }
  });
});
