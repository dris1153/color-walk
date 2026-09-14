import { useCallback, useEffect, useRef, useState } from 'react';
import type { Item } from '../lib/color-index-client';

const isDetailEntry = (state: unknown) => (state as { cw?: string } | null)?.cw === 'detail';

/**
 * The overlay is a history entry, so Back closes it and the browser's own
 * gesture is the primary one. Everything that can race with that lives here:
 * repeated Escape before popstate lands must not pop a second entry and walk the
 * visitor off the site, and an entry orphaned by Forward must still close.
 */
export function useDetailOverlay(): {
  selected: Item | null;
  open: (item: Item) => void;
  requestClose: () => void;
} {
  const [selected, setSelected] = useState<Item | null>(null);
  const closingRef = useRef(false);

  const open = useCallback((item: Item) => {
    history.pushState({ cw: 'detail', id: item.id }, '');
    setSelected(item);
  }, []);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (isDetailEntry(history.state)) history.back();
    else setSelected(null);
    if (!isDetailEntry(history.state)) closingRef.current = false;
  }, []);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      if (isDetailEntry(event.state)) return; // navigating into a detail entry
      closingRef.current = false;
      setSelected(null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return { selected, open, requestClose };
}
