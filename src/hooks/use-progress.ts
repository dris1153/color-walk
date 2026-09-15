import { useCallback, useState } from 'react';
import { readProgress, writeProgress, type Progress } from '../lib/game-store';

/** Read once on mount: nothing else in the page writes this key, and a stale
 *  read across tabs costs a streak, not correctness. */
export function useProgress(): {
  progress: Progress;
  update: (change: (previous: Progress) => Progress) => void;
} {
  const [progress, setProgress] = useState<Progress>(readProgress);

  const update = useCallback((change: (previous: Progress) => Progress) => {
    setProgress((previous) => {
      const next = change(previous);
      if (next !== previous) writeProgress(next);
      return next;
    });
  }, []);

  return { progress, update };
}
