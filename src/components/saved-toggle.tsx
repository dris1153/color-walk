type Props = {
  count: number;
  showingSaved: boolean;
  onToggle: () => void;
};

/** Hidden until something is saved, so the browsing view stays uncluttered. */
export function SavedToggle({ count, showingSaved, onToggle }: Props) {
  if (count === 0) return null;

  return (
    <div className="mb-3 flex justify-end">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={showingSaved}
        className="border border-ink/20 px-3 py-1.5 font-mono text-[11px] tracking-widest uppercase text-ink/60 hover:text-ink aria-pressed:border-ink/50 aria-pressed:text-ink"
      >
        {showingSaved ? `Back to browsing` : `Saved (${count})`}
      </button>
    </div>
  );
}
