import { useCallback, useEffect, useRef, useState } from 'react';
import { isItem, type Item } from '../lib/color-index-client';

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

  // The work itself rides in the entry, so Back from a twin lands on the work
  // it was opened from rather than leaving the overlay showing the wrong one.
  const open = useCallback((item: Item) => {
    history.pushState({ cw: 'detail', id: item.id, item }, '');
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
      closingRef.current = false;
      if (isDetailEntry(event.state)) {
        // Back or Forward into a detail entry: show that work. history.state is
        // same-origin but still a file the page did not just build, so it
        // passes the same gate as the index.
        const stored = (event.state as { item?: unknown }).item;
        setSelected(isItem(stored) ? stored : null);
        return;
      }
      setSelected(null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return { selected, open, requestClose };
}
