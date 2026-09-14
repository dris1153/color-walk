import { useEffect } from 'react';
import { nearestColorName } from '../lib/color-name-table';
import type { HueSelection } from '../lib/color-math';

const NEUTRAL_ACCENT = '#6b7280';

const label = (hue: HueSelection) =>
  hue === null ? null : hue === 'grey' ? 'Monochrome' : `H ${hue} / ${nearestColorName(hue)}`;

/** The page's own colour and name follow the chosen hue, so a pinned tab and a
 *  bookmark both say where the reader is. */
export function useDocumentChrome(hue: HueSelection): void {
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--accent',
      typeof hue === 'number' ? `hsl(${hue} 70% 55%)` : NEUTRAL_ACCENT,
    );
  }, [hue]);

  useEffect(() => {
    const where = label(hue);
    document.title = where === null ? 'Color Walk' : `Color Walk - ${where}`;
  }, [hue]);
}
