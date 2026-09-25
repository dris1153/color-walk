import { useState } from 'react';
import { isAllowedImageUrl } from '../lib/image-url';
import { paletteGradient } from '../lib/palette-gradient';
import { transitionName } from '../lib/view-transition';
import type { Item } from '../lib/color-index-client';

type Props = {
  item: Item;
  eager: boolean;
  /** Whether the card takes part in a view transition when the order changes. */
  named: boolean;
  onSelect: (item: Item) => void;
  onImageError: () => void;
  onImageLoad: () => void;
};

export function ArtworkCard({ item, eager, named, onSelect, onImageError, onImageLoad }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  // The index is a file, and files get edited: re-check before it reaches src.
  const allowed = isAllowedImageUrl(item.thumb);

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="group relative block w-full overflow-hidden"
      style={{
        aspectRatio: `${item.w} / ${item.h}`,
        backgroundColor: item.hex,
        viewTransitionName: named ? transitionName(item.id) : undefined,
      }}
    >
      {allowed && (
        <img
          src={item.thumb}
          alt={item.t}
          width={item.w}
          height={item.h}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          decoding="async"
          className="h-full w-full object-cover transition-opacity duration-500"
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => {
            setLoaded(true);
            onImageLoad();
          }}
          onError={() => {
            setFailed(true);
            onImageError();
          }}
        />
      )}
      {failed && (
        <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 bg-white/40" />
      )}
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-left opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {/* The work's colours in proportion, so the card says what the grid sorted it by. */}
        <span aria-hidden className="mb-2 block h-1" style={{ background: paletteGradient(item) }} />
        <span className="block truncate font-display text-sm text-ink">{item.t}</span>
        <span className="block truncate text-xs text-ink/70">{item.a}</span>
      </figcaption>
    </button>
  );
}
