import { useState, type ReactNode } from 'react';
import { isFiltering, type Filter } from '../lib/facets';
import { GalleryFilters } from './gallery-filters';
import { VisionControl } from './vision-control';

type Props = {
  filter: Filter;
  onFilter: (next: Partial<Filter>) => void;
  /** The facet filters apply to browsing only, not to the saved works or an activity. */
  showFilters: boolean;
  saved: ReactNode;
};

const TOGGLE =
  'border border-ink/20 bg-ground px-2 py-1.5 font-mono text-[11px] tracking-widest uppercase text-ink/70 hover:text-ink aria-expanded:border-ink/60 aria-expanded:text-ink lg:hidden';

/**
 * Filters and the vision control, inline on a wide screen and behind one
 * button on a phone, where laid out in full they took 127 px above the first
 * work. VisionControl stays mounted when hidden: it is what applies the filter.
 */
export function GalleryToolbar({ filter, onFilter, showFilters, saved }: Props) {
  const [open, setOpen] = useState(false);
  const active = [filter.kind, filter.era, filter.region].filter(Boolean).length;

  return (
    <div className="mb-3 flex flex-wrap items-start gap-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={TOGGLE}>
        Filters{active > 0 ? ` (${active})` : ''}
      </button>
      <div className={`${open ? 'flex' : 'hidden'} w-full flex-wrap items-start gap-2 lg:flex lg:w-auto`}>
        {showFilters && <GalleryFilters filter={filter} onChange={onFilter} />}
        <VisionControl />
      </div>
      {isFiltering(filter) && !open && (
        <span className="self-center font-mono text-[10px] tracking-widest uppercase text-ink/40 lg:hidden">filtered</span>
      )}
      <div className="ml-auto">{saved}</div>
    </div>
  );
}
