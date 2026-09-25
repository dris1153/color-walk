import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { hslToHex, normalizeHue, type HueSelection } from '../lib/color-math';
import { HUE_SEGMENT_WEIGHTS } from '../lib/hue-density';
import { nearestColorName } from '../lib/color-name-table';
import { hueToHandlePosition, pointToHue, ringSegments } from '../lib/hue-wheel-geometry';
import { withViewTransition } from '../lib/view-transition';
import type { ViewState } from '../lib/view-hash';

type Props = {
  hue: HueSelection;
  onHueChange: (hue: number | null) => void;
  onGestureEnd: (next?: Partial<ViewState>) => void;
};

const STEP = 5;
const PAGE_STEP = 15;
const RING_SATURATION = 70;
const RING_LIGHTNESS = 55;

// Computed once: the weights are baked in at build time and never change.
const SEGMENTS = ringSegments(HUE_SEGMENT_WEIGHTS, (hue) =>
  hslToHex(hue, RING_SATURATION, RING_LIGHTNESS),
);

export function HueWheel({ hue, onHueChange, onGestureEnd }: Props) {
  const ringRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const emitFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const el = ringRef.current;
    if (!el) return;
    onHueChange(pointToHue(el.getBoundingClientRect(), event.clientX, event.clientY));
  };

  // The press is a jump and gets a transition; the moves that may follow are a drag and do not.
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    withViewTransition(() => emitFromPointer(event));
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) emitFromPointer(event);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onGestureEnd();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = typeof hue === 'number' ? hue : 0;
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowUp' ? STEP
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -STEP
      : event.key === 'PageUp' ? PAGE_STEP
      : event.key === 'PageDown' ? -PAGE_STEP
      : null;

    if (delta !== null) withViewTransition(() => onHueChange(normalizeHue(current + delta)));
    else if (event.key === 'Home') withViewTransition(() => onHueChange(0));
    else return;
    event.preventDefault();
  };

  // 'grey' has no place on the ring, and saying "All colours" there would tell a
  // screen reader the opposite of what the grid is showing.
  const label =
    hue === 'grey' ? 'Monochrome, no hue'
    : hue === null ? 'All colours'
    : `Hue ${hue}, ${nearestColorName(hue)}`;

  return (
    <div
      ref={ringRef}
      role="slider"
      tabIndex={0}
      aria-label="Hue"
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={typeof hue === 'number' ? hue : 0}
      aria-valuetext={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      onKeyUp={() => onGestureEnd()}
      className="hue-ring relative h-32 w-32 rounded-full lg:h-44 lg:w-44"
    >
      {/* The ring is the collection, not a colour picker: each arc is one hue
          bucket and its thickness is how many works live there. The five empty
          buckets draw nothing, so the gaps are honest. */}
      <svg
        viewBox="0 0 100 100"
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {SEGMENTS.map((segment) => (
          <path
            key={segment.d}
            d={segment.d}
            stroke={segment.color}
            strokeWidth={segment.width}
            fill="none"
          />
        ))}
      </svg>
      {typeof hue === 'number' && (
        <span
          aria-hidden
          style={hueToHandlePosition(hue)}
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ground bg-ink shadow"
        />
      )}
    </div>
  );
}
