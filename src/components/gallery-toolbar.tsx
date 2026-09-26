import { useState, type ReactNode } from 'react';
import { isFiltering, NO_FILTER, type Filter } from '../lib/facets';
import { GalleryFilters } from './gallery-filters';
import { VisionControl } from './vision-control';

type Props = {
  filter: Filter;
  onFilter: (next: Partial<Filter>) => void;
  /** The facet filters apply to browsing only, not to the saved works or an activity. */
  showFilters: boolean;
  saved: ReactNode;
};

const BUTTON =
  'border border-ink/20 bg-ground px-2 py-1.5 font-mono text-[11px] tracking-widest uppercase text-ink/70 hover:border-ink/60 hover:text-ink aria-expanded:border-ink/60 aria-expanded:text-ink';

/**
 * Filters and the vision control, inline on a wide screen and behind one
 * button on a phone, where laid out in full they took 127 px above the first
 * work. It sticks to the top, so clearing a filter never means scrolling back
 * up a long grid. VisionControl stays mounted when hidden: it applies the filter.
 */
export function GalleryToolbar({ filter, onFilter, showFilters, saved }: Props) {
  const [open, setOpen] = useState(false);
  const active = [filter.kind, filter.era, filter.region].filter(Boolean).length;

  return (
    <div className="sticky top-0 z-20 -mx-1.5 mb-3 flex flex-wrap items-start gap-2 bg-ground/90 px-1.5 py-2 backdrop-blur">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={`${BUTTON} lg:hidden`}>
        Filters{active > 0 ? ` (${active})` : ''}
      </button>
      <div className={`${open ? 'flex' : 'hidden'} w-full flex-wrap items-start gap-2 lg:flex lg:w-auto`}>
        {showFilters && <GalleryFilters filter={filter} onChange={onFilter} />}
        <VisionControl />
      </div>
      <div className="ml-auto flex items-center gap-2">
        {saved}
        {showFilters && isFiltering(filter) && (
          <button type="button" onClick={() => onFilter(NO_FILTER)} className={BUTTON}>
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
