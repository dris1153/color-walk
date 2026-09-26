import { describe, expect, it } from 'vitest';
import { inkFor, paletteCss, savedPalette } from '../palette-card';
import { paletteBands } from '../palette-gradient';

describe('paletteBands', () => {
  it('normalises shares and leads with the worn colour', () => {
    const bands = paletteBands({ hex: '#a14c42', pct: 0.6, p: [[200, 50, 50, 0.2]] });
    expect(bands[0]![0]).toBe('#a14c42');
    expect(bands[0]![1]).toBeCloseTo(0.75);
    expect(bands.reduce((s, [, share]) => s + share, 0)).toBeCloseTo(1);
  });

  it('is one colour when there is nothing else', () => {
    expect(paletteBands({ hex: '#745f49', pct: 1, p: [] })).toEqual([['#745f49', 1]]);
  });
});

describe('paletteCss', () => {
  it('writes custom properties with their shares', () => {
    expect(paletteCss([['#a14c42', 0.75], ['#4080bf', 0.25]])).toBe(
      ':root {\n  --colour-1: #a14c42; /* 75% */\n  --colour-2: #4080bf; /* 25% */\n}',
    );
  });
});

describe('savedPalette', () => {
  it('puts saved works in wheel order with equal widths, sixteen at most', () => {
    const works = Array.from({ length: 20 }, (_, i) => ({ hex: `#${String(i).padStart(6, '0')}`, hue: 300 - i * 10, lig: 50 }));
    const bands = savedPalette(works);
    expect(bands).toHaveLength(16);
    expect(bands[0]![0]).toBe('#000019');
    expect(bands[0]![1]).toBeCloseTo(1 / 16);
  });
});

describe('inkFor', () => {
  it('picks readable text for light and dark colours', () => {
    expect(inkFor('#f5e6c8')).toBe('#0b0b0c');
    expect(inkFor('#1b2a4a')).toBe('#f2efe9');
  });
});
