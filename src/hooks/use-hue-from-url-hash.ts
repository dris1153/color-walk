import { useCallback, useEffect, useRef, useState } from 'react';

/** Safari throttles history writes to ~100 per 30 s, so never write per pointermove. */
const COMMIT_THROTTLE_MS = 300;

function parseHash(hash: string): number | null {
  const value = hash.replace(/^#/, '').split('h=')[1];
  if (value === undefined || value === 'all') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(359, Math.max(0, Math.round(n)));
}

export function useHueFromUrlHash(): {
  hue: number | null;
  setHue: (h: number | null) => void;
  /**
   * Pass the value when committing in the same tick as `setHue`; React has not
   * re-rendered yet, so without it the old hue would be written to the URL.
   * A gesture end (pointerup, keyup) happens after a render and needs no value.
   */
  commitHash: (next?: number | null) => void;
} {
  const [hue, setHue] = useState<number | null>(() => parseHash(window.location.hash));
  const hueRef = useRef(hue);
  hueRef.current = hue;
  const lastCommit = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const write = useCallback(() => {
    lastCommit.current = Date.now();
    const value = hueRef.current === null ? 'all' : String(hueRef.current);
    try {
      // history.state is passed through so phase 3's detail marker survives.
      history.replaceState(history.state, '', `#h=${value}`);
    } catch {
      /* Safari throttle: the hue still lives in React state, so nothing breaks. */
    }
  }, []);

  const commitHash = useCallback((next?: number | null) => {
    if (next !== undefined) hueRef.current = next;
    window.clearTimeout(timer.current);
    const wait = COMMIT_THROTTLE_MS - (Date.now() - lastCommit.current);
    if (wait <= 0) write();
    else timer.current = window.setTimeout(write, wait);
  }, [write]);

  useEffect(() => {
    const onHashChange = () => {
      const next = parseHash(window.location.hash);
      setHue((current) => (current === next ? current : next));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.clearTimeout(timer.current);
    };
  }, []);

  return { hue, setHue, commitHash };
}
