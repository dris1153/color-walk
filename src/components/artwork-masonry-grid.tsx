import { useMemo } from 'react';
import { distributeToColumns } from '../lib/masonry-distribute';
import type { Item } from '../lib/color-index-client';
import { ArtworkCard } from './artwork-card';

/**
 * Roughly what fits above the fold, so eager loading tracks the column count
 * instead of a fixed 8. At two columns a fixed 8 puts four off-screen images
 * into the same high-priority race as the one that decides LCP.
 */
const EAGER_ROWS = 2;

type Props = {
  items: Item[];
  columns: number;
  onSelect: (item: Item) => void;
  onImageError: () => void;
  onImageLoad: () => void;
};

export function ArtworkMasonryGrid({
  items,
  columns,
  onSelect,
  onImageError,
  onImageLoad,
}: Props) {
  const cols = useMemo(() => distributeToColumns(items, columns), [items, columns]);
  const eagerIds = useMemo(
    () => new Set(items.slice(0, columns * EAGER_ROWS).map((i) => i.id)),
    [items, columns],
  );

  return (
    <div className="flex gap-1.5">
      {cols.map((column, index) => (
        <div key={index} className="flex min-w-0 flex-1 flex-col gap-1.5">
          {column.map((item) => (
            <ArtworkCard
              key={item.id}
              item={item}
              eager={eagerIds.has(item.id)}
              onSelect={onSelect}
              onImageError={onImageError}
              onImageLoad={onImageLoad}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
