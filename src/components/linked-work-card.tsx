import type { Item } from '../lib/color-index-client';

type Props = {
  work: Item;
  /** What the link is: "Its twin at the Rijksmuseum", "Its echo, 2,300 years earlier". */
  label: string;
  onOpen: (item: Item) => void;
};

/** Another work this one points at, opened with a click. */
export function LinkedWorkCard({ work, label, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen(work)}
      className="group flex items-center gap-3 border border-ink/15 p-2 text-left hover:border-ink/60"
      aria-label={`${label}: ${work.t}`}
    >
      <img src={work.thumb} alt="" className="h-14 w-14 shrink-0 object-cover" style={{ backgroundColor: work.hex }} />
      <span className="min-w-0">
        <span className="block font-mono text-[10px] tracking-widest uppercase text-ink/40">{label}</span>
        <span className="block truncate text-sm text-ink group-hover:underline">{work.t}</span>
        <span className="block font-mono text-[10px] text-ink/50">{work.hex}</span>
      </span>
    </button>
  );
}
