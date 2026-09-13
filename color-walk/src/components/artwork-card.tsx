import { useState } from 'react';
import { isAllowedImageUrl } from '../lib/image-url';
import type { Item } from '../lib/color-index-client';

type Props = {
  item: Item;
  eager: boolean;
  onSelect: (item: Item) => void;
  onImageError: () => void;
  onImageLoad: () => void;
};

export function ArtworkCard({ item, eager, onSelect, onImageError, onImageLoad }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  // The index is a file, and files get edited: re-check before it reaches src.
  const allowed = isAllowedImageUrl(item.thumb);

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="group relative block w-full overflow-hidden"
      style={{ aspectRatio: `${item.w} / ${item.h}`, backgroundColor: item.hex }}
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
        <span className="block truncate font-display text-sm text-ink">{item.t}</span>
        <span className="block truncate text-xs text-ink/70">{item.a}</span>
      </figcaption>
    </button>
  );
}
