import { ColourGames } from './colour-games';
import { ColourWalk } from './colour-walk';
import { CompositionSearch } from './composition-search';
import { EraColours } from './era-colours';
import { WordColour } from './word-colour';
import type { Activity } from './activity-links';
import type { WalkPoint } from '../lib/walk-route';
import type { Item } from '../lib/color-index-client';

type Props = {
  activity: Activity;
  walk: { target: WalkPoint | null; start: (to: WalkPoint) => void };
  from: WalkPoint;
  onOpen: (item: Item) => void;
  onJumpToHue: (hue: number) => void;
  /** A hue (or none, to keep the current one) filtered to an era. */
  onBrowseEra: (hue: number | null, era: string) => void;
  onClose: () => void;
};

/** Whichever activity has replaced the grid. The walk alone keeps URL state. */
export function ActivityView({ activity, walk, from, onOpen, onJumpToHue, onBrowseEra, onClose }: Props) {
  switch (activity) {
    case 'walk':
      return <ColourWalk from={from} target={walk.target} onStart={walk.start} onSelect={onOpen} onClose={onClose} />;
    case 'play':
      return <ColourGames onClose={onClose} />;
    case 'compose':
      return <CompositionSearch onOpen={onOpen} onClose={onClose} />;
    case 'word':
      return (
        <WordColour
          onJumpToHue={(hue) => {
            onClose();
            onJumpToHue(hue);
          }}
          onClose={onClose}
        />
      );
    case 'eras':
      return (
        <EraColours
          onPick={(hue, era) => {
            onClose();
            onBrowseEra(hue, era);
          }}
          onClose={onClose}
        />
      );
  }
}
