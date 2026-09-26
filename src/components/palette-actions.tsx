import { useState } from 'react';
import { CARD_HEIGHT, CARD_WIDTH, drawPaletteCard, paletteCss } from '../lib/palette-card';
import type { Band } from '../lib/palette-gradient';

type Props = { bands: readonly Band[]; title: string; subtitle: string; fileName: string };

const LINK = 'font-mono text-[11px] tracking-widest uppercase text-ink/60 underline underline-offset-4 hover:text-ink';

/** Take the colours away: a PNG card, or CSS custom properties. */
export function PaletteActions({ bands, title, subtitle, fileName }: Props) {
  const [css, setCss] = useState<string | null>(null);

  const saveCard = async () => {
    await document.fonts?.load('40px Fraunces').catch(() => undefined);
    const canvas = document.createElement('canvas');
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawPaletteCard(ctx, bands, title, subtitle);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  };

  // The text is shown whatever the clipboard says: it refuses often enough
  // (no trusted gesture, a locked-down browser) that the button alone could
  // silently do nothing.
  const copyCss = () => {
    const text = paletteCss(bands);
    setCss(text);
    navigator.clipboard?.writeText(text).catch(() => undefined);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-4">
        <button type="button" onClick={() => void saveCard()} className={LINK}>
          Palette card
        </button>
        <button type="button" onClick={copyCss} className={LINK}>
          Copy CSS
        </button>
      </div>
      {css && <pre className="select-all overflow-x-auto border border-ink/15 p-2 font-mono text-[10px] text-ink/70">{css}</pre>}
    </div>
  );
}
