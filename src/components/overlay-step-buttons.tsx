import type { Item } from '../lib/color-index-client';

type Props = {
  prev: Item | null;
  next: Item | null;
  onStep: (delta: -1 | 1) => void;
};

const STEP_CLASS =
  'absolute top-1/2 z-10 h-10 w-10 -translate-y-1/2 border border-ink/30 bg-ground/70 font-mono text-ink/80 backdrop-blur hover:text-ink disabled:opacity-30';

/** Chevrons at the edges of the picture; absent when there is nothing either side. */
export function OverlayStepButtons({ prev, next, onStep }: Props) {
  if (!prev && !next) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => onStep(-1)}
        disabled={!prev}
        aria-label="Previous work"
        className={`${STEP_CLASS} left-2`}
      >
        &larr;
      </button>
      <button
        type="button"
        onClick={() => onStep(1)}
        disabled={!next}
        aria-label="Next work"
        className={`${STEP_CLASS} right-2`}
      >
        &rarr;
      </button>
    </>
  );
}
