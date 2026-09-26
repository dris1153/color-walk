import { ColourFromImage } from './colour-from-image';
import type { HueSelection } from '../lib/color-math';

export type Activity = 'walk' | 'play' | 'compose' | 'word' | 'eras' | 'mosaic';

type Props = {
  onColourFromImage: (hue: HueSelection, lightness: number) => void;
  onActivity: (activity: Activity) => void;
};

const LINK =
  'font-mono text-[10px] tracking-widest uppercase text-ink/50 underline decoration-ink/20 underline-offset-4 hover:text-ink hover:decoration-ink/50';

const LINKS: readonly [Activity, string][] = [
  ['walk', 'Walk'],
  ['play', 'Play'],
  ['compose', 'Arrange'],
  ['word', 'Words'],
  ['eras', 'Eras'],
  ['mosaic', 'Mosaic'],
];

/** The ways into the collection that are not the wheel. */
export function ActivityLinks({ onColourFromImage, onActivity }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      <ColourFromImage onColour={onColourFromImage} />
      {LINKS.map(([activity, label]) => (
        <button key={activity} type="button" onClick={() => onActivity(activity)} className={LINK}>
          {label}
        </button>
      ))}
    </div>
  );
}
