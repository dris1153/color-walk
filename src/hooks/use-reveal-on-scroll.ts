import { useEffect, useRef, type RefObject } from 'react';

/**
 * Reveals the next batch when a sentinel nears the viewport. The margin is a
 * full viewport, so the batch lands before the reader reaches the end rather
 * than after they have already stopped.
 */
export function useRevealOnScroll(reveal: () => void): RefObject<HTMLDivElement | null> {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) reveal();
      },
      { rootMargin: '100% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reveal]);

  return sentinelRef;
}
