import { eraLabel, eraOf, kindLabel, NO_FILTER, regionLabel, type Filter } from '../lib/facets';
import type { Item } from '../lib/color-index-client';

type Props = {
  item: Item;
  /** More of this kind, era or region, in this work's colour. */
  onBrowse: (facet: Filter) => void;
};

const CHIP =
  'border border-ink/20 px-2 py-1 font-mono text-[10px] tracking-widest uppercase text-ink/60 hover:border-ink/60 hover:text-ink';

/** What the index knows about the work, each a way to more like it. */
export function ArtworkFacetChips({ item, onBrowse }: Props) {
  const era = item.y !== undefined ? eraOf(item.y) : null;
  const chips = [
    { label: kindLabel(item.k), facet: { ...NO_FILTER, kind: item.k ?? null } },
    { label: eraLabel(era), facet: { ...NO_FILTER, era } },
    { label: regionLabel(item.r), facet: { ...NO_FILTER, region: item.r ?? null } },
  ].filter((c): c is { label: string; facet: Filter } => c.label !== null);
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map(({ label, facet }) => (
        <button
          key={label}
          type="button"
          onClick={() => onBrowse(facet)}
          aria-label={`Browse ${label} in this colour`}
          className={CHIP}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
