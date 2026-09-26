import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW, changedCount, parseViewSettings } from '../view-settings';

describe('parseViewSettings', () => {
  it('keeps valid settings', () => {
    const s = { vision: 'deuteranopia', pictures: 'swatches', palette: true, titles: false, size: 'L' };
    expect(parseViewSettings(s)).toEqual(s);
  });

  it('falls back field by field on anything it does not know', () => {
    expect(parseViewSettings({ vision: 'x-ray', pictures: 'squint', palette: 'yes', size: 'XL' })).toEqual({
      ...DEFAULT_VIEW,
      pictures: 'squint',
    });
    expect(parseViewSettings(null)).toEqual(DEFAULT_VIEW);
  });
});

describe('changedCount', () => {
  it('counts the settings that differ from the default', () => {
    expect(changedCount(DEFAULT_VIEW)).toBe(0);
    expect(changedCount({ ...DEFAULT_VIEW, titles: true, size: 'S' })).toBe(2);
  });
});
