type Props = {
  total: number;
  revealed: number;
  hue: number | null | 'grey';
  searching: boolean;
  more: boolean;
  onSearchMore: () => void;
};

const line = 'py-10 text-center font-mono text-xs tracking-widest uppercase text-ink/50';
const button = 'border border-current px-4 py-2';

/**
 * The end of a filtered grid: still looking, ask before looking further, or
 * done. Clearing lives in the sticky toolbar, not down here after a long scroll.
 */
export function FilterStatus({ total, revealed, hue, searching, more, onSearchMore }: Props) {
  if (searching) return <p className={line}>Looking further for matches</p>;
  if (revealed < total) return null;

  if (hue === null) {
    return <p className={line}>{total} matches in the all-colours sample. Pick a colour to search all of it.</p>;
  }
  if (more) {
    return (
      <div className={line}>
        <p>{total === 0 ? 'No matches yet' : `${total} matches so far`}</p>
        <div className="mt-3 flex justify-center">
          <button type="button" onClick={onSearchMore} className={button}>
            Keep looking
          </button>
        </div>
      </div>
    );
  }
  return <p className={line}>{total === 0 ? 'Nothing in this hue matches' : 'No more matches in this hue'}</p>;
}
