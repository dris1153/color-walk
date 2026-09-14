import { useCallback } from 'react';
import { hslToHex } from '../lib/color-math';
import { nearestColorName, toneName } from '../lib/color-name-table';
import type { ViewState } from '../lib/view-hash';
import { HueWheel } from './hue-wheel';
import { ToneSlider } from './tone-slider';

type Props = {
  hue: number | null;
  tone: number | null;
  onHueChange: (hue: number | null) => void;
  onToneChange: (tone: number | null) => void;
  onGestureEnd: (next?: Partial<ViewState>) => void;
};

const SWATCH_SATURATION = 70;
const DEFAULT_LIGHTNESS = 55;
const NEUTRAL_SWATCH = '#6b7280';

/**
 * Hue and tone read as one instrument: the ring picks the hue, the track picks
 * the lightness, and the disc in the middle shows the colour they add up to.
 * The panel behind them is not decoration - without it the controls sit
 * directly on the artwork and the labels are unreadable over a pale work.
 */
export function ColourControls({
  hue,
  tone,
  onHueChange,
  onToneChange,
  onGestureEnd,
}: Props) {
  const swatch =
    hue === null ? NEUTRAL_SWATCH
    : hslToHex(hue, SWATCH_SATURATION, tone ?? DEFAULT_LIGHTNESS);
  const nothingChosen = hue === null && tone === null;

  const clear = useCallback(() => {
    onHueChange(null);
    onToneChange(null);
    onGestureEnd({ hue: null, tone: null }); // same tick as the setters
  }, [onHueChange, onToneChange, onGestureEnd]);

  const readout = [
    hue === null ? 'All colours' : nearestColorName(hue),
    tone === null ? 'Any tone' : toneName(tone),
  ].join(' \u00b7 ');

  return (
    <div className="flex w-44 flex-col items-center gap-2 border border-ink/10 bg-ground/90 px-3 py-3 backdrop-blur lg:w-52">
      <div className="relative grid place-items-center">
        <HueWheel hue={hue} onHueChange={onHueChange} onGestureEnd={onGestureEnd} />
        {/* A sibling of the ring, not a child: a button inside role="slider" is
            poor ARIA, and its pointer events would bubble into the ring's drag. */}
        <button
          type="button"
          disabled={nothingChosen}
          onClick={clear}
          aria-label="Clear colour and tone"
          style={{ backgroundColor: swatch }}
          className="absolute h-14 w-14 rounded-full border border-ink/20 transition-colors duration-300 disabled:opacity-60 lg:h-20 lg:w-20"
        />
      </div>

      <ToneSlider
        hue={hue}
        tone={tone}
        onToneChange={onToneChange}
        onGestureEnd={onGestureEnd}
      />

      <p className="whitespace-nowrap text-center font-mono text-[10px] leading-none tracking-wide uppercase text-ink/70">
        {readout}
      </p>
    </div>
  );
}
