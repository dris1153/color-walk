import type { RefObject } from 'react';
import type { useArtworksByHue } from '../hooks/use-artworks-by-hue';
import { isFiltering, type Filter } from '../lib/facets';
import type { Item } from '../lib/color-index-client';
import { ArtworkHueRing } from './artwork-hue-ring';
import { ArtworkMasonryGrid } from './artwork-masonry-grid';
import { CollectionRing } from './collection-ring';
import { FilterStatus } from './filter-status';
import { GalleryStatus } from './gallery-status';
import { PaletteActions } from './palette-actions';
import { savedPalette } from '../lib/palette-card';

type Props = {
  gallery: ReturnType<typeof useArtworksByHue>;
  filter: Filter;
  hue: number | null | 'grey';
  columns: number;
  asRing: boolean;
  showingSaved: boolean;
  favourites: Item[];
  sentinelRef: RefObject<HTMLDivElement | null>;
  onOpen: (item: Item) => void;
  onJumpToHue: (hue: number) => void;
  onClearFilter: () => void;
};

/** The browsing view: the landing ring, the saved works, or the grid for a colour. */
export function GalleryBody({
  gallery,
  filter,
  hue,
  columns,
  asRing,
  showingSaved,
  favourites,
  sentinelRef,
  onOpen,
  onJumpToHue,
  onClearFilter,
}: Props) {
  const browsing = !showingSaved && !asRing;
  return (
    <>
      {asRing ? (
        <ArtworkHueRing items={gallery.items} onSelect={onOpen} />
      ) : (
        <>
          {showingSaved && <CollectionRing items={favourites} />}
          {showingSaved && favourites.length > 0 && (
            <div className="mb-4 flex justify-center">
              <PaletteActions
                bands={savedPalette(favourites)}
                title="My Color Walk palette"
                subtitle={`${favourites.length} saved works`}
                fileName="color-walk-palette.png"
              />
            </div>
          )}
          <ArtworkMasonryGrid
            items={showingSaved ? favourites : gallery.revealed}
            columns={columns}
            onSelect={onOpen}
            onImageError={gallery.noteImageError}
            onImageLoad={gallery.noteImageLoad}
          />
        </>
      )}
      {!asRing && <div ref={sentinelRef} className="h-px" />}
      {browsing && isFiltering(filter) && gallery.status === 'ready' && (
        <FilterStatus
          total={gallery.items.length}
          revealed={gallery.revealed.length}
          hue={hue}
          searching={gallery.searching}
          more={gallery.more}
          onSearchMore={gallery.searchMore}
          onClear={onClearFilter}
        />
      )}
      {browsing && !(isFiltering(filter) && gallery.status === 'ready') && (
        <GalleryStatus
          status={gallery.status}
          total={gallery.items.length}
          revealed={gallery.revealed.length}
          hue={hue}
          onHueChange={onJumpToHue}
          retryDisabled={gallery.retryDisabled}
          onRetry={gallery.retry}
        />
      )}
    </>
  );
}
