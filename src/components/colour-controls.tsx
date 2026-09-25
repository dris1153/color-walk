import { useCallback, useState } from 'react';
import { hslToHex, type HueSelection } from '../lib/color-math';
import { nearestColorName, toneName } from '../lib/color-name-table';
import { isAllowedImageUrl } from '../lib/image-url';
import { withViewTransition } from '../lib/view-transition';
import type { Item } from '../lib/color-index-client';
import type { ViewState } from '../lib/view-hash';
import { HueWheel } from './hue-wheel';
import { ToneSlider } from './tone-slider';
import { ActivityLinks, type Activity } from './activity-links';

type Props = {
  hue: HueSelection;
  tone: number | null;
  topItem: Item | null;
  onHueChange: (hue: HueSelection) => void;
  onToneChange: (tone: number | null) => void;
  onGestureEnd: (next?: Partial<ViewState>) => void;
  onSelect: (item: Item) => void;
  onColourFromImage: (hue: HueSelection, lightness: number) => void;
  onActivity: (activity: Activity) => void;
};

const SWATCH_SATURATION = 70;
const DEFAULT_LIGHTNESS = 55;
const NEUTRAL_SWATCH = '#6b7280';

/**
 * Hue and tone read as one instrument: the ring is the collection's own hue
 * histogram, the track picks the lightness, and the disc in the middle resolves
 * into the work those two actually rank first.
 */
export function ColourControls({
  hue,
  tone,
  topItem,
  onHueChange,
  onToneChange,
  onGestureEnd,
  onSelect,
  onColourFromImage,
  onActivity,
}: Props) {
  // While a gesture is in progress the centre stays a flat colour. Swapping the
  // artwork on every frame of a drag would both flicker and pull thumbnails at
  // 60 Hz; resolving on release makes letting go the moment instead.
  const [adjusting, setAdjusting] = useState(false);

  const changeHue = useCallback(
    (next: number | null) => {
      setAdjusting(true);
      onHueChange(next);
    },
    [onHueChange],
  );

  const changeTone = useCallback(
    (next: number | null) => {
      setAdjusting(true);
      onToneChange(next);
    },
    [onToneChange],
  );

  const settle = useCallback(
    (next?: Partial<ViewState>) => {
      setAdjusting(false);
      onGestureEnd(next);
    },
    [onGestureEnd],
  );

  // Ink, calligraphy and prints have a tone but no hue, so they sit outside the
  // ring rather than anywhere on it. Clicking again returns to all colours.
  const toggleGrey = useCallback(() => {
    const next = hue === 'grey' ? null : 'grey';
    setAdjusting(false);
    withViewTransition(() => onHueChange(next));
    onGestureEnd({ hue: next }); // same tick as the setter
  }, [hue, onHueChange, onGestureEnd]);

  const clear = useCallback(() => {
    setAdjusting(false);
    withViewTransition(() => {
      onHueChange(null);
      onToneChange(null);
    });
    onGestureEnd({ hue: null, tone: null }); // same tick as the setters
  }, [onHueChange, onToneChange, onGestureEnd]);

  // The wheel and the track only understand a real hue; monochrome has none.
  const wheelHue = typeof hue === 'number' ? hue : null;
  const swatch =
    hue === 'grey' ? hslToHex(0, 0, tone ?? DEFAULT_LIGHTNESS)
    : hue === null ? NEUTRAL_SWATCH
    : hslToHex(hue, SWATCH_SATURATION, tone ?? DEFAULT_LIGHTNESS);
  const anythingChosen = hue !== null || tone !== null;
  const preview = !adjusting && topItem && isAllowedImageUrl(topItem.thumb) ? topItem : null;

  const readout = [
    hue === 'grey' ? 'Monochrome'
    : hue === null ? 'All colours'
    : nearestColorName(hue),
    tone === null ? 'Any tone' : toneName(tone),
  ].join(' \u00b7 ');

  return (
    <div className="flex w-44 flex-col items-center gap-2 border border-ink/10 bg-ground/90 px-3 py-3 backdrop-blur lg:w-52">
      <div className="relative grid place-items-center">
        <HueWheel hue={hue} onHueChange={changeHue} onGestureEnd={settle} />
        {/* A sibling of the ring, not a child: a button inside role="slider" is
            poor ARIA, and its pointer events would bubble into the ring's drag. */}
        {preview ? (
          <button
            type="button"
            onClick={() => onSelect(preview)}
            aria-label={`Open ${preview.t}`}
            className="absolute h-14 w-14 overflow-hidden rounded-full border border-ink/20 lg:h-20 lg:w-20"
          >
            <img
              src={preview.thumb}
              alt=""
              className="h-full w-full object-cover"
              style={{ backgroundColor: preview.hex }}
            />
          </button>
        ) : (
          <div
            aria-hidden
            style={{ backgroundColor: swatch }}
            className="pointer-events-none absolute h-14 w-14 rounded-full border border-ink/20 transition-colors duration-300 lg:h-20 lg:w-20"
          />
        )}
      </div>

      <ToneSlider hue={wheelHue} tone={tone} onToneChange={changeTone} onGestureEnd={settle} />

      <p className="flex items-center gap-2 whitespace-nowrap text-center font-mono text-[10px] leading-none tracking-wide uppercase text-ink/70">
        <button
          type="button"
          onClick={toggleGrey}
          aria-pressed={hue === 'grey'}
          aria-label="Monochrome works"
          title="Monochrome works"
          style={{ background: 'linear-gradient(135deg, #1c1c1c 50%, #e8e8e8 50%)' }}
          className="h-3.5 w-3.5 shrink-0 rounded-full border border-ink/25 hover:border-ink/60 aria-pressed:border-ink"
        />
        {readout}
        {anythingChosen && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear colour and tone"
            className="text-ink/50 hover:text-ink"
          >
            &times;
          </button>
        )}
      </p>

      <ActivityLinks onColourFromImage={onColourFromImage} onActivity={onActivity} />
    </div>
  );
}
