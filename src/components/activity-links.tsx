import { useState } from 'react';
import { ColourFromImage } from './colour-from-image';
import type { HueSelection } from '../lib/color-math';

export type Activity = 'walk' | 'play' | 'compose' | 'word' | 'eras' | 'echoes' | 'mosaic' | 'slow';
/** Everything a link can start: an activity, or the camera, which drives the grid itself. */
export type Entry = Activity | 'camera';

type Props = {
  onColourFromImage: (hue: HueSelection, lightness: number) => void;
  onActivity: (entry: Entry) => void;
};

const LINK =
  'font-mono text-[10px] tracking-widest uppercase text-ink/50 underline decoration-ink/20 underline-offset-4 hover:text-ink hover:decoration-ink/50 aria-expanded:text-ink';

const EXPLORE: readonly [Activity, string][] = [
  ['walk', 'Walk'],
  ['eras', 'Eras'],
  ['echoes', 'Echoes'],
  ['word', 'Words'],
  ['compose', 'Arrange'],
  ['slow', 'Slow looking'],
];
const YOURS: readonly [Entry, string][] = [
  ['camera', 'Camera'],
  ['mosaic', 'Mosaic'],
];

type Group = 'explore' | 'yours';

/**
 * The ways into the collection that are not the wheel, in three groups rather
 * than a row of nine: on a phone the flat row took three lines of the panel
 * that already covered a third of the screen.
 */
export function ActivityLinks({ onColourFromImage, onActivity }: Props) {
  const [open, setOpen] = useState<Group | null>(null);
  const toggle = (group: Group) => setOpen((g) => (g === group ? null : group));
  const start = (entry: Entry) => {
    setOpen(null);
    onActivity(entry);
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-3">
        <button type="button" aria-expanded={open === 'explore'} onClick={() => toggle('explore')} className={LINK}>
          Explore
        </button>
        <button type="button" onClick={() => start('play')} className={LINK}>
          Play
        </button>
        <button type="button" aria-expanded={open === 'yours'} onClick={() => toggle('yours')} className={LINK}>
          Your pictures
        </button>
      </div>
      {open && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-ink/10 pt-1">
          {open === 'yours' && <ColourFromImage onColour={onColourFromImage} />}
          {(open === 'explore' ? EXPLORE : YOURS).map(([entry, label]) => (
            <button key={entry} type="button" onClick={() => start(entry)} className={LINK}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
