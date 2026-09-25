import { flushSync } from 'react-dom';

/** A view-transition-name must be a CSS identifier; ids carry dots (cma-2003.91). */
export const transitionName = (id: string): string => `w-${id.replace(/[^A-Za-z0-9_-]/g, '_')}`;

/**
 * Runs a discrete change of view as a view transition where the browser has
 * one, so the cards slide to their new order instead of snapping. A drag never
 * comes through here: it re-sorts on every frame, and a transition per frame
 * would both stutter and hide the frames behind the last snapshot.
 */
export function withViewTransition(update: () => void): void {
  if (
    typeof document.startViewTransition !== 'function' ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    update();
    return;
  }
  document.startViewTransition(() => flushSync(update));
}
