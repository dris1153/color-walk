import type { Band } from './palette-gradient';

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const SAVED_MAX = 16;

/** The saved works as one palette: each work's own colour, equal widths, in wheel order. */
export function savedPalette(works: readonly { hex: string; hue: number; lig: number }[]): Band[] {
  const picked = [...works].sort((a, b) => a.hue - b.hue || a.lig - b.lig).slice(0, SAVED_MAX);
  return picked.map((w) => [w.hex, 1 / picked.length]);
}

/** Colours as CSS custom properties, each with its share, ready to paste. */
export function paletteCss(bands: readonly Band[]): string {
  return [':root {', ...bands.map(([hex, share], i) => `  --colour-${i + 1}: ${hex}; /* ${Math.round(share * 100)}% */`), '}'].join('\n');
}

/** Dark text on light colours, light on dark: relative luminance against the midpoint. */
export function inkFor(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? '#0b0b0c' : '#f2efe9';
}

/**
 * A 1200x630 card: the colours as bands in proportion, each labelled with its
 * hex, and the title underneath. Colours and text only - no museum image is
 * drawn, so the canvas stays exportable.
 */
export function drawPaletteCard(ctx: CanvasRenderingContext2D, bands: readonly Band[], title: string, subtitle: string): void {
  const bandHeight = 470;
  ctx.fillStyle = '#0b0b0c';
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  let x = 0;
  bands.forEach(([hex, share], i) => {
    // The last band takes the remainder, so rounding never leaves a hairline gap.
    const w = i === bands.length - 1 ? CARD_WIDTH - x : Math.round(share * CARD_WIDTH);
    ctx.fillStyle = hex;
    ctx.fillRect(x, 0, w, bandHeight);
    if (w >= 70) {
      ctx.fillStyle = inkFor(hex);
      ctx.font = '20px ui-monospace, Menlo, monospace';
      ctx.fillText(hex, x + 16, bandHeight - 22);
    }
    x += w;
  });
  ctx.fillStyle = '#f2efe9';
  ctx.font = '40px Fraunces, Georgia, serif';
  ctx.fillText(title.length > 48 ? `${title.slice(0, 47)}…` : title, 40, bandHeight + 70);
  ctx.fillStyle = 'rgba(242,239,233,0.6)';
  ctx.font = '20px ui-monospace, Menlo, monospace';
  ctx.fillText(subtitle, 40, bandHeight + 112);
  ctx.textAlign = 'right';
  ctx.fillText('Color Walk', CARD_WIDTH - 40, bandHeight + 112);
  ctx.textAlign = 'left';
}
