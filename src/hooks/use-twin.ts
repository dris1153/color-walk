import { useEffect, useState } from 'react';
import { loadTwin, type Item, type Twin } from '../lib/color-index-client';

/** Resolved lazily: the overlay is already open before the twin is needed. */
export function useTwin(twin: Twin | undefined): Item | null {
  const [item, setItem] = useState<Item | null>(null);

  useEffect(() => {
    let stale = false;
    setItem(null);
    if (!twin) return;
    loadTwin(twin)
      .then((found) => {
        if (!stale) setItem(found);
      })
      .catch(() => {
        /* the overlay simply shows no twin */
      });
    return () => {
      stale = true;
    };
  }, [twin]);

  return item;
}
