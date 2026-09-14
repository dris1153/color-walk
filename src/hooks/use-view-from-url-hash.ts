import { useCallback, useEffect, useRef, useState } from 'react';
import { formatViewHash, parseViewHash, type ViewState } from '../lib/view-hash';
import type { HueSelection } from '../lib/color-math';

/** Safari throttles history writes to ~100 per 30 s, so never write per pointermove. */
const COMMIT_THROTTLE_MS = 300;

export function useViewFromUrlHash(): {
  hue: HueSelection;
  tone: number | null;
  setHue: (h: HueSelection) => void;
  setTone: (l: number | null) => void;
  /**
   * Pass the changed part when committing in the same tick as a setter; React
   * has not re-rendered yet, so without it the previous value would be written
   * to the URL. A gesture end (pointerup, keyup) runs after a render and needs
   * no argument.
   */
  commitHash: (next?: Partial<ViewState>) => void;
  /**
   * A discrete jump, not a drag, so it earns its own history entry and Back
   * returns the reader to the colour they came from.
   */
  pushHash: (next: Partial<ViewState>) => void;
} {
  const [view, setView] = useState<ViewState>(() => parseViewHash(window.location.hash));
  const viewRef = useRef(view);
  viewRef.current = view;
  const lastCommit = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const setHue = useCallback((hue: HueSelection) => setView((v) => ({ ...v, hue })), []);
  const setTone = useCallback((tone: number | null) => setView((v) => ({ ...v, tone })), []);

  const write = useCallback(() => {
    lastCommit.current = Date.now();
    try {
      // history.state is passed through so the detail overlay's marker survives.
      history.replaceState(history.state, '', formatViewHash(viewRef.current));
    } catch {
      /* Safari throttle: the view still lives in React state, so nothing breaks. */
    }
  }, []);

  const commitHash = useCallback(
    (next?: Partial<ViewState>) => {
      if (next) viewRef.current = { ...viewRef.current, ...next };
      window.clearTimeout(timer.current);
      const wait = COMMIT_THROTTLE_MS - (Date.now() - lastCommit.current);
      if (wait <= 0) write();
      else timer.current = window.setTimeout(write, wait);
    },
    [write],
  );

  const pushHash = useCallback((next: Partial<ViewState>) => {
    viewRef.current = { ...viewRef.current, ...next };
    window.clearTimeout(timer.current);
    lastCommit.current = Date.now();
    try {
      // null state, not the current one: a colour is a gallery entry, and
      // copying a detail marker here would leave a phantom overlay entry.
      history.pushState(null, '', formatViewHash(viewRef.current));
    } catch {
      /* Safari throttle: the view still lives in React state, so nothing breaks. */
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const next = parseViewHash(window.location.hash);
      setView((current) =>
        current.hue === next.hue && current.tone === next.tone ? current : next,
      );
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.clearTimeout(timer.current);
    };
  }, []);

  return { hue: view.hue, tone: view.tone, setHue, setTone, commitHash, pushHash };
}
