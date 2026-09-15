import { useCallback, useState } from 'react';
import { formatWalkTarget, parseWalkTarget, type WalkPoint } from '../lib/walk-route';
import { formatViewHash, type ViewState } from '../lib/view-hash';

/**
 * A walk rides alongside the view in the hash rather than replacing it, so
 * `#h=30&l=50&walk=210,45` is shareable and ending the walk leaves the reader
 * exactly where they set off from.
 */
export function useWalkState(view: ViewState): {
  walking: boolean;
  target: WalkPoint | null;
  plan: () => void;
  start: (to: WalkPoint) => void;
  end: () => void;
} {
  const [target, setTarget] = useState<WalkPoint | null>(() => parseWalkTarget(window.location.hash));
  const [walking, setWalking] = useState(() => parseWalkTarget(window.location.hash) !== null);

  const write = useCallback((suffix: string) => {
    try {
      history.replaceState(history.state, '', suffix);
    } catch {
      /* Safari throttle: the walk still lives in React state, so nothing breaks. */
    }
  }, []);

  return {
    walking,
    target,
    plan: useCallback(() => {
      setTarget(null);
      setWalking(true);
    }, []),
    start: useCallback(
      (to: WalkPoint) => {
        setTarget(to);
        write(`${formatViewHash(view)}&${formatWalkTarget(to)}`);
      },
      [view, write],
    ),
    end: useCallback(() => {
      setWalking(false);
      setTarget(null);
      write(formatViewHash(view));
    }, [view, write]),
  };
}
