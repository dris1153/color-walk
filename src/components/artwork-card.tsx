import { useState } from 'react';
import { isAllowedImageUrl } from '../lib/image-url';
import { paletteGradient } from '../lib/palette-gradient';
import { inkFor } from '../lib/palette-card';
import { transitionName } from '../lib/view-transition';
import type { Item } from '../lib/color-index-client';
import { useViewSettings } from './view-settings-provider';

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
  const { settings } = useViewSettings();
  // The index is a file, and files get edited: re-check before it reaches src.
  const allowed = isAllowedImageUrl(item.thumb);
  // Swatches only: no image is requested at all, so the grid is the sort itself.
  const swatch = settings.pictures === 'swatches';

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
      {allowed && !swatch && (
        <img
          src={item.thumb}
          alt={item.t}
          width={item.w}
          height={item.h}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          decoding="async"
          // Squint: blurred into its colour masses, scaled so the soft edge stays outside the card.
          className={`h-full w-full object-cover transition-opacity duration-500 ${settings.pictures === 'squint' ? 'scale-110 blur-[6px]' : ''}`}
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
      {swatch && (
        <span className="absolute left-2 top-2 font-mono text-[10px]" style={{ color: inkFor(item.hex) }}>
          {item.hex}
        </span>
      )}
      {failed && !swatch && <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 bg-white/40" />}
      <figcaption
        className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-left transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${settings.titles ? 'opacity-100' : 'opacity-0'}`}
      >
        {/* The work's colours in proportion, so the card says what the grid sorted it by. */}
        {!settings.palette && <span aria-hidden className="mb-2 block h-1" style={{ background: paletteGradient(item) }} />}
        <span className="block truncate font-display text-sm text-ink">{item.t}</span>
        <span className="block truncate text-xs text-ink/70">{item.a}</span>
      </figcaption>
      {/* After the caption, so its dark gradient does not cover the strip. */}
      {settings.palette && (
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-1.5" style={{ background: paletteGradient(item) }} />
      )}
    </button>
  );
}
