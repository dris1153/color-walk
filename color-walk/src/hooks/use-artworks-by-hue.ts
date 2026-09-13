import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hueToBucket, sortByHueDistance } from '../lib/color-math';
import { loadBucketNear, type Item } from '../lib/color-index-client';

export type LoadStatus = 'loading' | 'ready' | 'error';

const REVEAL_STEP = 60;
const BACKOFF_MS = [2000, 4000, 8000];
const IMAGE_ERROR_LIMIT = 8;

export function useArtworksByHue(hue: number | null): {
  items: Item[];
  revealed: Item[];
  status: LoadStatus;
  revealMore: () => void;
  retry: () => void;
  retryDisabled: boolean;
  noteImageError: () => void;
  noteImageLoad: () => void;
  imagesDown: boolean;
} {
  const bucket = hue === null ? null : hueToBucket(hue);
  const [raw, setRaw] = useState<Item[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [revealCount, setRevealCount] = useState(REVEAL_STEP);
  const [retryDisabled, setRetryDisabled] = useState(false);
  const [imageErrors, setImageErrors] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  const attempt = useRef(0);
  const backoffTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    // A newer hue must win, but the request itself is left to finish and fill
    // the module cache, so returning to this hue costs nothing.
    let stale = false;
    setStatus('loading');
    loadBucketNear(bucket)
      .then((items) => {
        if (stale) return;
        attempt.current = 0;
        setRaw(items);
        setStatus('ready');
      })
      .catch(() => {
        if (stale) return;
        setStatus('error');
        setRetryDisabled(true);
        const wait = BACKOFF_MS[Math.min(attempt.current, BACKOFF_MS.length - 1)] ?? 8000;
        attempt.current += 1;
        backoffTimer.current = window.setTimeout(() => setRetryDisabled(false), wait);
      });
    return () => {
      stale = true;
      window.clearTimeout(backoffTimer.current);
    };
  }, [bucket, reloadToken]);

  // The sort key is the exact hue, so it changes only when the hue does.
  const items = useMemo(
    () => (hue === null ? raw : sortByHueDistance(raw, hue)),
    [raw, hue],
  );

  // The single place a sort-key change resets the view: nothing already on
  // screen is ever silently reordered underneath the reader.
  useEffect(() => {
    setRevealCount(REVEAL_STEP);
    setImageErrors(0);
    window.scrollTo(0, 0);
  }, [items]);

  const revealMore = useCallback(
    () => setRevealCount((c) => Math.min(c + REVEAL_STEP, items.length)),
    [items.length],
  );
  const retry = useCallback(() => setReloadToken((t) => t + 1), []);
  const noteImageError = useCallback(() => setImageErrors((c) => c + 1), []);
  const noteImageLoad = useCallback(() => setImageErrors(0), []);

  return {
    items,
    revealed: items.slice(0, revealCount),
    status,
    revealMore,
    retry,
    retryDisabled,
    noteImageError,
    noteImageLoad,
    imagesDown: imageErrors > IMAGE_ERROR_LIMIT && revealCount === REVEAL_STEP,
  };
}
