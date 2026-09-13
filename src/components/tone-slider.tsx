import { useEffect, useRef, type ChangeEvent } from 'react';
import { toneName } from '../lib/color-name-table';
import type { ViewState } from '../lib/view-hash';

type Props = {
  tone: number | null;
  onToneChange: (tone: number | null) => void;
  onGestureEnd: (next?: Partial<ViewState>) => void;
};

/** Shown when no tone is chosen, so the thumb has somewhere neutral to sit. */
const NEUTRAL_POSITION = 50;

export function ToneSlider({ tone, onToneChange, onGestureEnd }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const label = tone === null ? 'Any tone' : `Tone ${tone} / ${toneName(tone)}`;

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
    <div className="flex w-40 flex-col items-center gap-1 lg:w-[220px]">
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
        aria-valuetext={label}
        className="w-full cursor-pointer"
        style={{
          accentColor: 'var(--accent)',
          opacity: tone === null ? 0.45 : 1,
        }}
      />
      {tone === null ? (
        <p className="font-mono text-[10px] tracking-widest uppercase text-ink/40">Any tone</p>
      ) : (
        <button
          type="button"
          onClick={() => {
            onToneChange(null);
            onGestureEnd({ tone: null }); // same tick as the setter, so be explicit
          }}
          className="font-mono text-[10px] tracking-widest uppercase text-ink/70 hover:text-ink"
        >
          {label} &times;
        </button>
      )}
    </div>
  );
}
