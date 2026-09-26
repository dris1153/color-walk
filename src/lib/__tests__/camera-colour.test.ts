import { describe, expect, it } from 'vitest';
import { changedEnough } from '../camera-colour';

describe('changedEnough', () => {
  it('always moves on the first reading', () => {
    expect(changedEnough(null, { hue: 30, lig: 50 })).toBe(true);
  });

  it('ignores sensor noise and follows a real change', () => {
    expect(changedEnough({ hue: 30, lig: 50 }, { hue: 36, lig: 54 })).toBe(false);
    expect(changedEnough({ hue: 30, lig: 50 }, { hue: 45, lig: 50 })).toBe(true);
    expect(changedEnough({ hue: 30, lig: 50 }, { hue: 30, lig: 60 })).toBe(true);
  });

  it('measures hue the short way round the wheel', () => {
    expect(changedEnough({ hue: 355, lig: 50 }, { hue: 3, lig: 50 })).toBe(false);
  });

  it('moves between a colour and monochrome', () => {
    expect(changedEnough({ hue: 30, lig: 50 }, { hue: 'grey', lig: 50 })).toBe(true);
    expect(changedEnough({ hue: 'grey', lig: 50 }, { hue: 'grey', lig: 52 })).toBe(false);
  });
});
