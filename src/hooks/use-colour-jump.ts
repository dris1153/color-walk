import { useCallback, useEffect, useState } from 'react';
import { clampTone, type HueSelection } from '../lib/color-math';
import type { Filter } from '../lib/facets';
import { withViewTransition } from '../lib/view-transition';
import type { ViewState } from '../lib/view-hash';
import type { Item } from '../lib/color-index-client';

type Options = {
  selected: Item | null;
  requestClose: () => void;
  setHue: (hue: HueSelection) => void;
  setTone: (tone: number | null) => void;
  setFilter: (next: Partial<Filter>) => void;
  pushHash: (next: Partial<ViewState>) => void;
  commitHash: (next?: Partial<ViewState>) => void;
  onLeaveSaved: () => void;
};

/** The hash keeps a facet absent rather than null, so null becomes undefined there. */
export const filterToView = (f: Partial<Filter>): Partial<ViewState> =>
  Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v ?? undefined]));

/** Landing the grid on one exact colour, from a swatch or from a picture,
 *  optionally narrowed to a kind, era or region. */
export function useColourJump({
  selected,
  requestClose,
  setHue,
  setTone,
  setFilter,
  pushHash,
  commitHash,
  onLeaveSaved,
}: Options): {
  browseColour: (hue: number, lightness: number, facet?: Filter) => void;
  jumpToColour: (hue: HueSelection, lightness: number, facet?: Filter) => void;
  followColour: (hue: HueSelection, lightness: number) => void;
} {
  const [pending, setPending] = useState<{ hue: number; lig: number; facet?: Filter } | null>(null);

  const jumpToColour = useCallback(
    (hue: HueSelection, lightness: number, facet?: Filter) => {
      const tone = clampTone(lightness);
      onLeaveSaved();
      withViewTransition(() => {
        setHue(hue);
        setTone(tone);
        if (facet) setFilter(facet);
      });
      pushHash({ hue, tone, ...(facet && filterToView(facet)) });
    },
    [onLeaveSaved, setHue, setTone, setFilter, pushHash],
  );

  // A colour that keeps changing (the camera) rewrites the entry instead of
  // adding one per second, and skips the transition, which would never settle.
  const followColour = useCallback(
    (hue: HueSelection, lightness: number) => {
      const tone = clampTone(lightness);
      onLeaveSaved();
      setHue(hue);
      setTone(tone);
      commitHash({ hue, tone });
    },
    [onLeaveSaved, setHue, setTone, commitHash],
  );

  // Both axes are set, not just the hue: a swatch shows one colour, and hue
  // alone would answer with that hue at every lightness.
  const browseColour = useCallback(
    (hue: number, lig: number, facet?: Filter) => {
      setPending({ hue, lig, facet });
      requestClose();
    },
    [requestClose],
  );

  // Closing the overlay is a history.back(), which lands after this tick and
  // would restore the URL this wrote. So the colour is applied only once the
  // overlay is actually gone.
  useEffect(() => {
    if (!pending || selected) return;
    jumpToColour(pending.hue, pending.lig, pending.facet);
    setPending(null);
  }, [pending, selected, jumpToColour]);

  return { browseColour, jumpToColour, followColour };
}
