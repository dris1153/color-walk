import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { normalizeHue } from '../lib/color-math';
import { nearestColorName } from '../lib/color-name-table';
import { hueToHandlePosition, pointToHue } from '../lib/hue-wheel-geometry';
import type { ViewState } from '../lib/view-hash';

type Props = {
  hue: number | null;
  onHueChange: (hue: number | null) => void;
  onGestureEnd: (next?: Partial<ViewState>) => void;
};

const STEP = 5;
const PAGE_STEP = 15;

export function HueWheel({ hue, onHueChange, onGestureEnd }: Props) {
  const ringRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const emitFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const el = ringRef.current;
    if (!el) return;
    onHueChange(pointToHue(el.getBoundingClientRect(), event.clientX, event.clientY));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    emitFromPointer(event);
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
    const current = hue ?? 0;
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowUp' ? STEP
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -STEP
      : event.key === 'PageUp' ? PAGE_STEP
      : event.key === 'PageDown' ? -PAGE_STEP
      : null;

    if (delta !== null) onHueChange(normalizeHue(current + delta));
    else if (event.key === 'Home') onHueChange(0);
    else return;
    event.preventDefault();
  };

  const label = hue === null ? 'All colours' : `Hue ${hue}, ${nearestColorName(hue)}`;

  return (
    <div
      ref={ringRef}
      role="slider"
      tabIndex={0}
      aria-label="Hue"
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={hue ?? 0}
      aria-valuetext={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      onKeyUp={() => onGestureEnd()}
      className="hue-ring relative h-32 w-32 rounded-full lg:h-44 lg:w-44"
    >
      {hue !== null && (
        <span
          aria-hidden
          style={hueToHandlePosition(hue)}
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ground bg-ink shadow"
        />
      )}
    </div>
  );
}
