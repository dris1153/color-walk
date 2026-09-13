import { useEffect, type RefObject } from 'react';

/**
 * Stronger than a hand-rolled focus trap, and the only thing that reliably
 * covers OpenSeadragon's own tabbable container: everything outside the dialog
 * is removed from the tab order and from assistive technology at once.
 */
export function useInertSiblings(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const node = ref.current;
    const root = document.getElementById('root');
    if (!node || !root) return;

    const marked: HTMLElement[] = [];
    for (const child of Array.from(root.children)) {
      if (!(child instanceof HTMLElement)) continue;
      if (child === node || child.contains(node)) continue;
      if (child.inert) continue; // left alone, because we did not set it
      child.inert = true;
      marked.push(child);
    }

    return () => {
      for (const el of marked) el.inert = false;
    };
  }, [ref]);
}
