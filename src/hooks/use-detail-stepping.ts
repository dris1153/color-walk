import { useCallback, useEffect, useMemo } from 'react';
import { nearEnd, neighbours } from '../lib/detail-stepping';
import { isAllowedImageUrl } from '../lib/image-url';
import type { Item } from '../lib/color-index-client';

type Options = {
  /** The order behind the overlay: the grid, or the saved works. */
  items: readonly Item[];
  /** How many of them are on screen. Stepping past that reveals more, so the
   *  grid the reader returns to has kept up with them. */
  shown: number;
  selected: Item | null;
  replace: (item: Item) => void;
  revealMore?: () => void;
};

const NONE = { index: -1, prev: null, next: null };

/** Stepping through the works either side of the open one, in the order on screen. */
export function useDetailStepping({ items, shown, selected, replace, revealMore }: Options): {
  prev: Item | null;
  next: Item | null;
  step: (delta: -1 | 1) => void;
} {
  const { index, prev, next } = useMemo(
    () => (selected ? neighbours(items, selected.id) : NONE),
    [items, selected],
  );

  // Both neighbours' thumbnails are fetched while this work is being looked at,
  // so a step shows a picture at once and not its colour.
  useEffect(() => {
    for (const item of [prev, next]) {
      if (item && isAllowedImageUrl(item.thumb)) new Image().src = item.thumb;
    }
  }, [prev, next]);

  const step = useCallback(
    (delta: -1 | 1) => {
      const target = delta > 0 ? next : prev;
      if (!target) return;
      replace(target);
      if (delta > 0 && nearEnd(index + 1, shown)) revealMore?.();
    },
    [prev, next, index, shown, replace, revealMore],
  );

  return { prev, next, step };
}
