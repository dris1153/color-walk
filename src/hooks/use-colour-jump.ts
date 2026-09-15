import { useCallback, useEffect, useState } from 'react';
import { clampTone, type HueSelection } from '../lib/color-math';
import type { ViewState } from '../lib/view-hash';
import type { Item } from '../lib/color-index-client';

type Options = {
  selected: Item | null;
  requestClose: () => void;
  setHue: (hue: HueSelection) => void;
  setTone: (tone: number | null) => void;
  pushHash: (next: Partial<ViewState>) => void;
  onLeaveSaved: () => void;
};

/** Landing the grid on one exact colour, from a swatch or from a picture. */
export function useColourJump({
  selected,
  requestClose,
  setHue,
  setTone,
  pushHash,
  onLeaveSaved,
}: Options): {
  browseColour: (hue: number, lightness: number) => void;
  jumpToColour: (hue: HueSelection, lightness: number) => void;
} {
  const [pending, setPending] = useState<{ hue: number; lig: number } | null>(null);

  const jumpToColour = useCallback(
    (hue: HueSelection, lightness: number) => {
      const tone = clampTone(lightness);
      onLeaveSaved();
      setHue(hue);
      setTone(tone);
      pushHash({ hue, tone });
    },
    [onLeaveSaved, setHue, setTone, pushHash],
  );

  // Both axes are set, not just the hue: a swatch shows one colour, and hue
  // alone would answer with that hue at every lightness.
  const browseColour = useCallback(
    (hue: number, lig: number) => {
      setPending({ hue, lig });
      requestClose();
    },
    [requestClose],
  );

  // Closing the overlay is a history.back(), which lands after this tick and
  // would restore the URL this wrote. So the colour is applied only once the
  // overlay is actually gone.
  useEffect(() => {
    if (!pending || selected) return;
    jumpToColour(pending.hue, pending.lig);
    setPending(null);
  }, [pending, selected, jumpToColour]);

  return { browseColour, jumpToColour };
}
