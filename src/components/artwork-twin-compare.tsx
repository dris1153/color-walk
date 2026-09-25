import { paletteGradient } from '../lib/palette-gradient';
import type { Item } from '../lib/color-index-client';

type Props = { item: Item; twin: Item };

const MUSEUM = { met: 'Metropolitan Museum', cma: 'Cleveland Museum' } as const;

/** The work and its twin at the other museum, side by side, each on its own colours. */
export function ArtworkTwinCompare({ item, twin }: Props) {
  return (
    <div className="flex h-full flex-col lg:flex-row">
      {[item, twin].map((work) => (
        <figure
          key={work.id}
          className="flex min-h-0 min-w-0 flex-1 flex-col"
          style={{ background: paletteGradient(work) }}
        >
          <img src={work.thumb} alt={work.t} className="min-h-0 w-full flex-1 object-contain p-4" />
          <figcaption className="truncate bg-ground/80 px-4 py-2 font-mono text-[10px] tracking-widest uppercase text-ink/70 backdrop-blur">
            <span className="text-ink">{work.t}</span> &middot; {MUSEUM[work.src]} &middot; {work.hex}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
