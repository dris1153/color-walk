import { afterEach, describe, expect, it, vi } from 'vitest';
import { transitionName, withViewTransition } from '../view-transition';

// Pure node: the DOM is stubbed just enough to see which path was taken.
const install = (doc: object, reduced = false) => {
  vi.stubGlobal('document', doc);
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
};

afterEach(() => vi.unstubAllGlobals());

describe('transitionName', () => {
  it('turns an index id into a CSS identifier', () => {
    expect(transitionName('met-442849')).toBe('w-met-442849');
    expect(transitionName('cma-2003.91')).toBe('w-cma-2003_91');
    expect(transitionName('cma-1915.123.a')).toBe('w-cma-1915_123_a');
  });
});

describe('withViewTransition', () => {
  it('updates at once where the browser has no view transitions', () => {
    install({});
    const update = vi.fn();
    withViewTransition(update);
    expect(update).toHaveBeenCalledOnce();
  });

  it('updates at once when motion is reduced, without starting a transition', () => {
    const startViewTransition = vi.fn();
    install({ startViewTransition }, true);
    const update = vi.fn();
    withViewTransition(update);
    expect(update).toHaveBeenCalledOnce();
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it('otherwise runs the update inside the transition', () => {
    const startViewTransition = vi.fn((cb: () => void) => cb());
    install({ startViewTransition });
    const update = vi.fn();
    withViewTransition(update);
    expect(startViewTransition).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
  });
});
