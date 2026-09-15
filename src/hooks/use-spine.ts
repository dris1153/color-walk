import { useEffect, useState } from 'react';
import { loadSpine, type Item } from '../lib/color-index-client';

/** The whole collection in one small file, for anything that has to move across
 *  hues rather than browse one at a time. */
export function useSpine(): { items: Item[]; status: 'loading' | 'ready' | 'error' } {
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let stale = false;
    loadSpine()
      .then((loaded) => {
        if (stale) return;
        setItems(loaded);
        setStatus('ready');
      })
      .catch(() => {
        if (!stale) setStatus('error');
      });
    return () => {
      stale = true;
    };
  }, []);

  return { items, status };
}
