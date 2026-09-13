import { isAllowedPageUrl } from '../lib/image-url';
import { nearestColorName } from '../lib/color-name-table';
import type { Item } from '../lib/color-index-client';

type Props = {
  item: Item;
  isSaved: boolean;
  onToggleSave: (item: Item) => void;
};

export function ArtworkMetadataPanel({ item, isSaved, onToggleSave }: Props) {
  // OpenSeadragon and the browser will follow whatever URL they are handed, so
  // a hand-edited index file must not be able to aim either one elsewhere.
  const museumLink = isAllowedPageUrl(item.page) ? item.page : null;

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-6 [overscroll-behavior:contain] lg:p-8">
      <div>
        <h2 className="font-display text-xl leading-tight text-ink lg:text-2xl">{item.t}</h2>
        <p className="mt-1 text-sm text-ink/70">{item.a}</p>
        {item.d && <p className="text-sm text-ink/50">{item.d}</p>}
      </div>

      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="h-10 w-10 shrink-0 border border-ink/20"
          style={{ backgroundColor: item.hex }}
        />
        <span className="font-mono text-xs tracking-widest uppercase text-ink/70">
          H {item.hue} / {nearestColorName(item.hue)}
        </span>
      </div>

      {item.credit && <p className="text-xs leading-relaxed text-ink/50">{item.credit}</p>}

      <button
        type="button"
        aria-pressed={isSaved}
        onClick={() => onToggleSave(item)}
        className="self-start border border-ink/25 px-3 py-1.5 font-mono text-[11px] tracking-widest uppercase text-ink/70 hover:text-ink aria-pressed:border-ink/60 aria-pressed:text-ink"
      >
        {isSaved ? 'Saved' : 'Save'}
      </button>

      {museumLink && (
        <a
          href={museumLink}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs tracking-widest uppercase text-ink/70 underline underline-offset-4 hover:text-ink"
        >
          View at the museum
        </a>
      )}
    </div>
  );
}
