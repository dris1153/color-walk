import { useState, type ReactNode } from 'react';
import { isFiltering, NO_FILTER, type Filter } from '../lib/facets';
import { GalleryFilters } from './gallery-filters';
import { ViewPanel } from './view-panel';

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
 * Two groups that used to look alike: on the left, FILTER changes which works
 * appear and lives in the URL; on the right, View changes how they look and
 * lives in this browser. On a phone the filters sit behind one button, where
 * laid out in full they took 127 px above the first work. The bar sticks to
 * the top, so clearing a filter never means scrolling back up a long grid.
 */
export function GalleryToolbar({ filter, onFilter, showFilters, saved }: Props) {
  const [open, setOpen] = useState(false);
  const active = [filter.kind, filter.era, filter.region].filter(Boolean).length;

  return (
    <div className="sticky top-0 z-20 -mx-1.5 mb-3 flex flex-wrap items-start gap-2 bg-ground/90 px-1.5 py-2 backdrop-blur">
      {showFilters && (
        <>
          <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={`${BUTTON} lg:hidden`}>
            Filter{active > 0 ? ` (${active})` : ''}
          </button>
          <div className={`${open ? 'flex' : 'hidden'} w-full items-center gap-2 lg:flex lg:w-auto`}>
            <span className="hidden font-mono text-[10px] tracking-widest uppercase text-ink/40 lg:inline">Filter</span>
            <GalleryFilters filter={filter} onChange={onFilter} />
          </div>
        </>
      )}
      <div className="ml-auto flex items-center gap-2">
        <ViewPanel />
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
