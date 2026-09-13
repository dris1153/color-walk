import { useEffect } from 'react';

/**
 * `body { overflow: hidden }` does not hold iOS Safari; only taking the body out
 * of flow does. The scroll offset is restored exactly on unlock.
 */
export function useBodyScrollLock(): void {
  useEffect(() => {
    const y = window.scrollY;
    const { style } = document.body;
    const previous = { position: style.position, top: style.top, width: style.width };

    style.position = 'fixed';
    style.top = `-${y}px`;
    style.width = '100%';

    return () => {
      style.position = previous.position;
      style.top = previous.top;
      style.width = previous.width;
      window.scrollTo(0, y);
    };
  }, []);
}
