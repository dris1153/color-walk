import { describe, expect, it } from 'vitest';
import { hslToHex } from '../color-math';
import { paletteGradient } from '../palette-gradient';

describe('paletteGradient', () => {
  it('is the lead colour alone when the work has no other', () => {
    expect(paletteGradient({ hex: '#745f49', pct: 1, p: [] })).toBe('#745f49');
    expect(paletteGradient({ hex: '#745f49', pct: 1 })).toBe('#745f49');
  });

  it('lays the bands out by share, the worn colour first', () => {
    const second = hslToHex(8, 24, 50);
    expect(paletteGradient({ hex: '#a14c42', pct: 0.9, p: [[8, 24, 50, 0.1]] })).toBe(
      `linear-gradient(to right, #a14c42 0.0% 90.0%, ${second} 90.0% 100.0%)`,
    );
  });

  it('normalises shares that do not add up to one', () => {
    const value = paletteGradient({ hex: '#111111', pct: 0.3, p: [[200, 50, 50, 0.3]] });
    expect(value).toContain('#111111 0.0% 50.0%');
    expect(value).toContain('50.0% 100.0%)');
  });

  it('falls back to the lead colour when the shares are unusable', () => {
    expect(paletteGradient({ hex: '#111111', pct: 0, p: [[200, 50, 50, 0]] })).toBe('#111111');
  });
});
