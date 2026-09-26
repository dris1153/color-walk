import { ERAS, KINDS, REGIONS, isFiltering, NO_FILTER, type Filter } from '../lib/facets';

type Props = {
  filter: Filter;
  onChange: (next: Partial<Filter>) => void;
};

const CONTROL =
  'border border-ink/20 bg-ground px-2 py-1.5 font-mono text-[11px] tracking-widest uppercase text-ink/70 hover:border-ink/50 hover:text-ink';

type FacetProps = {
  label: string;
  any: string;
  options: readonly { id: string; label: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
};

/** Native selects: keyboard, screen readers and phones get their own picker for free. */
function FacetSelect({ label, any, options, value, onChange }: FacetProps) {
  return (
    <select
      aria-label={label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={`${CONTROL} ${value ? 'border-ink/60 text-ink' : ''}`}
    >
      <option value="">{any}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Kind, time and place, over whatever colour the wheel has chosen. */
export function GalleryFilters({ filter, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FacetSelect label="Kind of object" any="Any kind" options={KINDS} value={filter.kind} onChange={(kind) => onChange({ kind })} />
      <FacetSelect label="Time" any="Any time" options={ERAS} value={filter.era} onChange={(era) => onChange({ era })} />
      <FacetSelect label="Region" any="Anywhere" options={REGIONS} value={filter.region} onChange={(region) => onChange({ region })} />
      {isFiltering(filter) && (
        <button type="button" onClick={() => onChange(NO_FILTER)} className={CONTROL} aria-label="Clear filters">
          &times;
        </button>
      )}
    </div>
  );
}
