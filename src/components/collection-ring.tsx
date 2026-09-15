import { COLLECTABLE, collectedBuckets } from '../lib/collection-progress';
import { BUCKET_WIDTH, hslToHex } from '../lib/color-math';
import { ringSegments } from '../lib/hue-wheel-geometry';
import { BUCKET_COLOR_NAMES } from '../lib/color-name-table';
import type { Item } from '../lib/color-index-client';

type Props = { items: readonly Item[] };

const FULL = Array.from({ length: COLLECTABLE }, () => 1);
const MISSING = '#2a2a2c';

/**
 * The saved list as a wheel to fill in. It sits here rather than on the control
 * ring on purpose: that ring says how much art exists, and laying personal
 * progress over it would blur what the collection holds with what the reader
 * has.
 */
export function CollectionRing({ items }: Props) {
  const found = collectedBuckets(items);
  const segments = ringSegments(FULL, (hue) => {
    const bucket = Math.round(hue / BUCKET_WIDTH) % COLLECTABLE;
    return found.has(bucket) ? hslToHex(hue, 70, 55) : MISSING;
  });
  const missing = BUCKET_COLOR_NAMES.filter((_, b) => !found.has(b));

  return (
    <div className="mb-6 flex flex-col items-center gap-2">
      <svg viewBox="0 0 100 100" className="h-28 w-28" role="img"
        aria-label={`${found.size} of ${COLLECTABLE} hues collected`}>
        {segments.map((segment, i) => (
          <path key={i} d={segment.d} stroke={segment.color} strokeWidth={segment.width} fill="none" />
        ))}
      </svg>
      <p className="font-mono text-[11px] tracking-widest uppercase text-ink/70">
        {found.size} of {COLLECTABLE} hues
      </p>
      {missing.length > 0 && missing.length <= 6 && (
        <p className="max-w-xs text-center font-mono text-[10px] text-ink/40">
          still missing {missing.join(', ').toLowerCase()}
        </p>
      )}
    </div>
  );
}
