import { useEffect, useRef, type ChangeEvent, type CSSProperties } from 'react';
import { hslToHex } from '../lib/color-math';
import { toneName } from '../lib/color-name-table';
import type { ViewState } from '../lib/view-hash';

type Props = {
  hue: number | null;
  tone: number | null;
  onToneChange: (tone: number | null) => void;
  onGestureEnd: (next?: Partial<ViewState>) => void;
};

/** Shown when no tone is chosen, so the thumb has somewhere neutral to sit. */
const NEUTRAL_POSITION = 50;
const TRACK_SATURATION = 70;

/** Dark to light in the chosen hue, so the control shows its own range. */
function trackGradient(hue: number | null): string {
  const sat = hue === null ? 0 : TRACK_SATURATION;
  const at = (lightness: number) => hslToHex(hue ?? 0, sat, lightness);
  return `linear-gradient(to right, ${at(6)}, ${at(28)}, ${at(50)}, ${at(72)}, ${at(94)})`;
}

export function ToneSlider({ hue, tone, onToneChange, onGestureEnd }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // React maps onChange onto the DOM `input` event, which fires on every frame
  // of a drag. The native `change` event is the one that means "committed", and
  // it is also what a value set by assistive technology raises.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const onCommit = () => onGestureEnd();
    el.addEventListener('change', onCommit);
    return () => el.removeEventListener('change', onCommit);
  }, [onGestureEnd]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onToneChange(Number(event.target.value));
  };

  return (
    <input
      ref={inputRef}
      type="range"
      min={0}
      max={100}
      step={1}
      value={tone ?? NEUTRAL_POSITION}
      onChange={handleChange}
      // Committed on release only: a write per input event would blow through
      // Safari's cap of roughly 100 history writes per 30 seconds.
      onPointerUp={() => onGestureEnd()}
      onKeyUp={() => onGestureEnd()}
      aria-label="Lightness"
      aria-valuetext={tone === null ? 'Any tone' : `Tone ${tone}, ${toneName(tone)}`}
      className="tone-range cursor-pointer"
      style={
        {
          '--tone-track': trackGradient(hue),
          opacity: tone === null ? 0.55 : 1,
        } as CSSProperties
      }
    />
  );
}
