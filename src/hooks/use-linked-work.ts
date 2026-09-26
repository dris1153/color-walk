import { useEffect, useState } from 'react';
import { loadTwin, type Item, type Twin } from '../lib/color-index-client';

/** A work an entry points at (its twin, its echo), resolved lazily: the overlay is already open before it is needed. */
export function useLinkedWork(link: Twin | undefined): Item | null {
  const [item, setItem] = useState<Item | null>(null);

  useEffect(() => {
    let stale = false;
    setItem(null);
    if (!link) return;
    loadTwin(link)
      .then((found) => {
        if (!stale) setItem(found);
      })
      .catch(() => {
        /* the overlay simply shows no card for it */
      });
    return () => {
      stale = true;
    };
  }, [link]);

  return item;
}
