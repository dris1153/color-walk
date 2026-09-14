import { normalizeHue } from '../lib/color-math';
import { nearestColorName } from '../lib/color-name-table';
import type { LoadStatus } from '../hooks/use-artworks-by-hue';

type Props = {
  status: LoadStatus;
  total: number;
  revealed: number;
  hue: number | null | 'grey';
  onHueChange: (hue: number) => void;
  retryDisabled: boolean;
  onRetry: () => void;
};

const line = 'py-10 text-center font-mono text-xs tracking-widest uppercase';
const button = 'border border-current px-4 py-2 disabled:opacity-40';

const NEIGHBOUR_STEP = 15;

export function GalleryStatus({
  status,
  total,
  revealed,
  hue,
  onHueChange,
  retryDisabled,
  onRetry,
}: Props) {
  if (status === 'loading') return null;

  if (status === 'error') {
    return (
      <div className={`${line} text-ink/70`}>
        <p>Could not load this colour</p>
        <button type="button" onClick={onRetry} disabled={retryDisabled} className={`mt-3 ${button}`}>
          {retryDisabled ? 'Retrying shortly' : 'Retry'}
        </button>
      </div>
    );
  }

  if (total === 0) {
    // Reachable only if every bucket file is empty: since phase 2 the loader
    // pads a thin hue from its neighbours, so a real hue always has works.
    const nearby =
      typeof hue === 'number' ? [-NEIGHBOUR_STEP, NEIGHBOUR_STEP].map((d) => normalizeHue(hue + d)) : [];
    return (
      <div className={`${line} text-ink/50`}>
        <p>Nothing in this hue yet. Try nearby.</p>
        <div className="mt-3 flex justify-center gap-2">
          {nearby.map((h) => (
            <button key={h} type="button" onClick={() => onHueChange(h)} className={button}>
              H {h} / {nearestColorName(h)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (revealed >= total) {
    return <p className={`${line} text-ink/40`}>End of this hue</p>;
  }

  return null;
}

/**
 * Fixed, so it takes no space in the flow: an in-flow spinner would be pushed
 * down by the arriving grid and that single shift was the whole CLS budget.
 */
export function GalleryLoading() {
  return (
    <p
      role="status"
      className="pointer-events-none fixed inset-x-0 top-1/2 z-20 text-center font-mono text-xs tracking-widest uppercase text-ink/50"
    >
      Loading this colour
    </p>
  );
}

/** Kept separate so a CDN failure is announced above the grid, not after it. */
export function ImagesUnavailableBanner() {
  return (
    <p
      role="status"
      className="mb-4 border border-ink/20 p-3 text-center font-mono text-xs tracking-wide text-ink/70"
    >
      Images are not loading right now. The museum&rsquo;s server may be blocking us.
    </p>
  );
}
