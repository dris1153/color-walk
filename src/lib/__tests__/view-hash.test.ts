import { describe, expect, it } from 'vitest';
import { formatViewHash, parseViewHash, parseViewLocation } from '../view-hash';
import { TONE_MAX, TONE_MIN } from '../color-math';

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

  it('clamps tone into the range the slider offers', () => {
    expect(parseViewHash('#l=-5').tone).toBe(TONE_MIN);
    expect(parseViewHash('#l=500').tone).toBe(TONE_MAX);
    // Links written before the range narrowed still resolve, to the nearest
    // tone that actually has works behind it.
    expect(parseViewHash('#l=5').tone).toBe(TONE_MIN);
    expect(parseViewHash('#l=95').tone).toBe(TONE_MAX);
    expect(parseViewHash('#l=46').tone).toBe(46);
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
    expect(formatViewHash({ hue: null, tone: TONE_MIN })).toBe(`#h=all&l=${TONE_MIN}`);
  });

  it('round-trips every combination', () => {
    for (const view of [
      { hue: 212, tone: null },
      { hue: null, tone: null },
      { hue: 0, tone: TONE_MIN },
      { hue: 359, tone: TONE_MAX },
      { hue: null, tone: 45 },
    ]) {
      expect(parseViewHash(formatViewHash(view))).toEqual(view);
    }
  });
});

describe('the monochrome view', () => {
  it('reads and writes #h=grey', () => {
    expect(parseViewHash('#h=grey')).toEqual({ hue: 'grey', tone: null });
    expect(formatViewHash({ hue: 'grey', tone: null })).toBe('#h=grey');
  });

  it('carries a tone, which is the only axis it has', () => {
    expect(parseViewHash('#h=grey&l=30')).toEqual({ hue: 'grey', tone: 30 });
    expect(formatViewHash({ hue: 'grey', tone: 30 })).toBe('#h=grey&l=30');
  });

  it('round-trips', () => {
    for (const view of [
      { hue: 'grey' as const, tone: null },
      { hue: 'grey' as const, tone: 45 },
    ]) {
      expect(parseViewHash(formatViewHash(view))).toEqual(view);
    }
  });

  it('is not confused with a hue named in words', () => {
    expect(parseViewHash('#h=greyish').hue).toBeNull();
  });
});

describe('parseViewLocation - the per-hue pages', () => {
  it('opens on the hue its page is named for', () => {
    expect(parseViewLocation('/c/210', '')).toEqual({ hue: 210, tone: null });
    expect(parseViewLocation('/c/0', '')).toEqual({ hue: 0, tone: null });
    expect(parseViewLocation('/c/grey', '')).toEqual({ hue: 'grey', tone: null });
  });

  it('tolerates the trailing slash a directory page may arrive with', () => {
    expect(parseViewLocation('/c/210/', '')).toEqual({ hue: 210, tone: null });
  });

  it('lets the fragment win, because it says more than the page does', () => {
    expect(parseViewLocation('/c/210', '#h=45&l=30')).toEqual({ hue: 45, tone: 30 });
    expect(parseViewLocation('/c/210', '#h=all')).toEqual({ hue: null, tone: null });
  });

  it('ignores a path that is not one of ours', () => {
    for (const p of ['/', '/c', '/c/210/extra', '/c/abc', '/c/999', '/x/210']) {
      expect(parseViewLocation(p, '')).toEqual({ hue: null, tone: null });
    }
  });
});
