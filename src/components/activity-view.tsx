import { ColourGames } from './colour-games';
import { ColourWalk } from './colour-walk';
import { CompositionSearch } from './composition-search';
import { EchoPairs } from './echo-pairs';
import { EraColours } from './era-colours';
import { MosaicMaker } from './mosaic-maker';
import { WordColour } from './word-colour';
import type { Activity } from './activity-links';
import type { WalkPoint } from '../lib/walk-route';
import type { Item } from '../lib/color-index-client';
import { hueToBucket } from '../lib/color-math';

type Props = {
  activity: Activity;
  walk: { target: WalkPoint | null; start: (to: WalkPoint) => void };
  from: WalkPoint;
  /** The wheel's hue, when one is chosen. */
  wheelHue: number | null;
  onOpen: (item: Item) => void;
  onJumpToHue: (hue: number) => void;
  /** A hue (or none, to keep the current one) filtered to an era. */
  onBrowseEra: (hue: number | null, era: string) => void;
  onClose: () => void;
};

/** Cerulean: the colour with the most to say across the eras, when the wheel has none. */
const HISTORY_DEFAULT_BUCKET = 14;

/** Whichever activity has replaced the grid. The walk alone keeps URL state. */
export function ActivityView({ activity, walk, from, wheelHue, onOpen, onJumpToHue, onBrowseEra, onClose }: Props) {
  switch (activity) {
    case 'walk':
      return <ColourWalk from={from} target={walk.target} onStart={walk.start} onSelect={onOpen} onClose={onClose} />;
    case 'play':
      return <ColourGames onClose={onClose} />;
    case 'compose':
      return <CompositionSearch onOpen={onOpen} onClose={onClose} />;
    case 'echoes':
      return <EchoPairs onOpen={onOpen} onClose={onClose} />;
    case 'mosaic':
      return <MosaicMaker onOpen={onOpen} onClose={onClose} />;
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
          initialBucket={wheelHue !== null ? hueToBucket(wheelHue) : HISTORY_DEFAULT_BUCKET}
          onPick={(hue, era) => {
            onClose();
            onBrowseEra(hue, era);
          }}
          onOpen={onOpen}
          onClose={onClose}
        />
      );
  }
}
