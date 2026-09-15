import { describe, expect, it } from 'vitest';
import {
  SPINE_HUE_STEPS,
  SPINE_TONE_BANDS,
  buildSpine,
  spineHueCell,
  spineNeutralStep,
  spineToneBand,
} from '../write-spine-file.mjs';

const work = (id: string, hue: number, lig: number, sat = 50, pct = 0.5) => ({
  id,
  hue,
  lig,
  sat,
  pct,
});
const grey = (id: string, lig: number, pct = 0.5) => ({ id, hue: 0, lig, sat: 0, pct });

describe('spine cells', () => {
  it('cuts the wheel into even steps and wraps at 360', () => {
    expect(spineHueCell(0)).toBe(0);
    expect(spineHueCell(359.9)).toBe(SPINE_HUE_STEPS - 1);
    expect(spineHueCell(360)).toBe(0);
  });

  it('keeps the lightest works inside the last tone band', () => {
    expect(spineToneBand(0)).toBe(0);
    expect(spineToneBand(100)).toBe(SPINE_TONE_BANDS - 1);
    expect(spineNeutralStep(100)).toBe(19);
  });
});

describe('buildSpine', () => {
  it('keeps one work per cell, the one that most reads as its colour', () => {
    const spine = buildSpine(
      [work('dull', 10, 50, 20, 0.3), work('vivid', 11, 52, 90, 0.9), work('mid', 12, 51, 50, 0.5)],
      [],
    );
    expect(spine.map((i: { id: string }) => i.id)).toEqual(['vivid']);
  });

  it('separates works that share a hue but not a tone', () => {
    const spine = buildSpine([work('dark', 10, 10), work('light', 10, 90)], []);
    expect(spine).toHaveLength(2);
  });

  it('orders coloured works by hue and puts the neutrals last', () => {
    const spine = buildSpine(
      [work('late', 300, 50), work('early', 20, 50)],
      [grey('g', 40)],
    );
    expect(spine.map((i: { id: string }) => i.id)).toEqual(['early', 'late', 'g']);
  });

  it('spreads the neutrals over the tone range rather than crowding one end', () => {
    const spine = buildSpine([], [grey('a', 10), grey('b', 12), grey('c', 80)]);
    const tones = spine.map((i: { lig: number }) => i.lig);
    expect(tones).toHaveLength(2); // 10 and 12 share a step; 80 is its own
    expect(Math.max(...tones) - Math.min(...tones)).toBeGreaterThan(50);
  });

  it('is deterministic when two works tie, so a rebuild does not churn the file', () => {
    const tie = [work('zzz', 10, 50, 60, 0.5), work('aaa', 11, 51, 60, 0.5)];
    expect(buildSpine(tie, []).map((i: { id: string }) => i.id)).toEqual(
      buildSpine([...tie].reverse(), []).map((i: { id: string }) => i.id),
    );
    expect(buildSpine(tie, [])[0]!.id).toBe('aaa');
  });

  it('has nothing to say about an empty collection', () => {
    expect(buildSpine([], [])).toEqual([]);
  });
});
