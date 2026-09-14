import { useState } from 'react';
import { ITEM_FRACTION, packHueRing } from '../lib/hue-ring-layout';
import { isAllowedImageUrl } from '../lib/image-url';
import type { Item } from '../lib/color-index-client';

type Props = {
  items: readonly Item[];
  onSelect: (item: Item) => void;
};

/**
 * The all-colours view laid out as the wheel it describes, each work standing as
 * the colour it contributed, with the work itself revealed on hover.
 *
 * Showing the photographs directly was tried first and does not work: measured
 * over the 300 landing works, the dominant colour fills a median 27% of the
 * frame and 211 of them under half, because most of the collection is objects
 * photographed on white studio grounds. A ring of those reads as scattered
 * coins, not as a wheel.
 *
 * Bounded by design: the landing sample is fixed, so unlike the grid there is
 * nothing to scroll and nothing to reveal.
 */
export function ArtworkHueRing({ items, onSelect }: Props) {
  // Only the work under the pointer loads its image. opacity-0 was tried and
  // still downloaded every one of them: 38 requests to show none.
  const [active, setActive] = useState<string | null>(null);
  const leave = (id: string) => setActive((current) => (current === id ? null : current));
  // The index is a file, and files get edited: re-check before it reaches src.
  const placed = packHueRing(items.filter((item) => isAllowedImageUrl(item.thumb)));

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[min(72vw,78vh)]"
      role="list"
      aria-label="The collection by hue"
    >
      {placed.map(({ item, left, top }) => (
        <button
          key={item.id}
          type="button"
          role="listitem"
          onClick={() => onSelect(item)}
          onPointerEnter={() => setActive(item.id)}
          onPointerLeave={() => leave(item.id)}
          onFocus={() => setActive(item.id)}
          onBlur={() => leave(item.id)}
          aria-label={`${item.t}${item.a ? `, ${item.a}` : ''}`}
          style={{ left: `${left}%`, top: `${top}%`, width: `${ITEM_FRACTION * 100}%` }}
          className="group absolute aspect-square -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border border-ink/15 transition-transform duration-200 hover:z-10 hover:scale-125 hover:border-ink/60 focus-visible:z-10 focus-visible:scale-125 focus-visible:border-ink motion-reduce:transition-none"
        >
          <span aria-hidden className="absolute inset-0" style={{ backgroundColor: item.hex }} />
          {active === item.id && (
            <img
              src={item.thumb}
              alt=""
              decoding="async"
              className="relative h-full w-full object-cover"
            />
          )}
        </button>
      ))}
    </div>
  );
}
