import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { normalizeHue } from '../lib/color-math';
import { nearestColorName } from '../lib/color-name-table';
import { hueToHandlePosition, pointToHue } from '../lib/hue-wheel-geometry';

type Props = {
  hue: number | null;
  onHueChange: (hue: number | null) => void;
  onGestureEnd: () => void;
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

  const size = 'h-40 w-40 lg:h-[220px] lg:w-[220px]';
  const label = hue === null ? 'All colours' : `Hue ${hue}, ${nearestColorName(hue)}`;

  return (
    <div className="flex flex-col items-center gap-3">
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
        onKeyUp={onGestureEnd}
        className={`hue-ring relative rounded-full ${size}`}
      >
        {hue !== null && (
          <span
            aria-hidden
            style={hueToHandlePosition(hue)}
            className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ground bg-ink shadow"
          />
        )}
        <div className="absolute inset-0 grid place-items-center">
          <button
            type="button"
            aria-pressed={hue === null}
            onClick={() => {
              onHueChange(null);
              onGestureEnd();
            }}
            className="rounded-full px-3 py-2 font-mono text-[10px] tracking-widest uppercase text-ink/70 hover:text-ink"
          >
            All
          </button>
        </div>
      </div>
      <p className="font-mono text-[11px] tracking-widest uppercase text-ink/70">
        {hue === null ? 'All colours' : `H ${hue} / ${nearestColorName(hue)}`}
      </p>
    </div>
  );
}
