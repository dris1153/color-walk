import { ColourGames } from './colour-games';
import { ColourWalk } from './colour-walk';
import { CompositionSearch } from './composition-search';
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
  onClose: () => void;
};

/** Whichever activity has replaced the grid. The walk alone keeps URL state. */
export function ActivityView({ activity, walk, from, onOpen, onJumpToHue, onClose }: Props) {
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
  }
}
