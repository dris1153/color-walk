type Props = {
  total: number;
  revealed: number;
  hue: number | null | 'grey';
  searching: boolean;
  more: boolean;
  onSearchMore: () => void;
  onClear: () => void;
};

const line = 'py-10 text-center font-mono text-xs tracking-widest uppercase text-ink/50';
const button = 'border border-current px-4 py-2';

/** The end of a filtered grid: still looking, ask before looking further, or done. */
export function FilterStatus({ total, revealed, hue, searching, more, onSearchMore, onClear }: Props) {
  if (searching) return <p className={line}>Looking further for matches</p>;
  if (revealed < total) return null;

  const clear = (
    <button type="button" onClick={onClear} className={button}>
      Clear filter
    </button>
  );
  if (hue === null) {
    return (
      <div className={line}>
        <p>{total} matches in the all-colours sample. Pick a colour to search all of it.</p>
        <div className="mt-3 flex justify-center gap-2">{clear}</div>
      </div>
    );
  }
  if (more) {
    return (
      <div className={line}>
        <p>{total === 0 ? 'No matches yet' : `${total} matches so far`}</p>
        <div className="mt-3 flex justify-center gap-2">
          <button type="button" onClick={onSearchMore} className={button}>
            Keep looking
          </button>
          {clear}
        </div>
      </div>
    );
  }
  return (
    <div className={line}>
      <p>{total === 0 ? 'Nothing in this hue matches' : 'No more matches in this hue'}</p>
      <div className="mt-3 flex justify-center gap-2">{clear}</div>
    </div>
  );
}
