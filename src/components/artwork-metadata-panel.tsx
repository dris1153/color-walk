import { isAllowedPageUrl } from '../lib/image-url';
import { nearestColorName } from '../lib/color-name-table';
import { hslToHex } from '../lib/color-math';
import { useTwin } from '../hooks/use-twin';
import type { Item } from '../lib/color-index-client';

type Props = {
  item: Item;
  isSaved: boolean;
  onToggleSave: (item: Item) => void;
  onBrowseColour: (hue: number, lightness: number) => void;
  onOpen: (item: Item) => void;
};

const MUSEUM = { met: 'the Metropolitan Museum', cma: 'the Cleveland Museum' } as const;

export function ArtworkMetadataPanel({ item, isSaved, onToggleSave, onBrowseColour, onOpen }: Props) {
  const twin = useTwin(item.twin);
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

      {/* The colour is the way back to the wheel: without it a work is a dead
          end, closable but with no route to anything like it. */}
      <button
        type="button"
        onClick={() => onBrowseColour(item.hue, item.lig)}
        className="group flex items-center gap-3 self-start text-left"
      >
        <span
          aria-hidden
          className="h-10 w-10 shrink-0 border border-ink/20 group-hover:border-ink/60"
          style={{ backgroundColor: item.hex }}
        />
        <span className="font-mono text-xs tracking-widest uppercase text-ink/70 underline decoration-ink/25 underline-offset-4 group-hover:text-ink group-hover:decoration-ink/60">
          Browse H {item.hue} / {nearestColorName(item.hue)}
        </span>
      </button>

      {item.p && item.p.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-widest uppercase text-ink/40">Also</span>
          {item.p.map(([hue, sat, lig, share]) => (
            <button
              key={hue}
              type="button"
              onClick={() => onBrowseColour(hue, lig)}
              aria-label={`Browse ${nearestColorName(hue)}, ${Math.round(share * 100)}% of this work`}
              className="h-6 w-6 shrink-0 border border-ink/20 hover:border-ink/60"
              style={{ backgroundColor: hslToHex(hue, sat, lig) }}
            />
          ))}
        </div>
      )}

      {twin && (
        <button
          type="button"
          onClick={() => onOpen(twin)}
          className="group flex items-center gap-3 border border-ink/15 p-2 text-left hover:border-ink/60"
          aria-label={`Open its twin, ${twin.t}`}
        >
          <img
            src={twin.thumb}
            alt=""
            className="h-14 w-14 shrink-0 object-cover"
            style={{ backgroundColor: twin.hex }}
          />
          <span className="min-w-0">
            <span className="block font-mono text-[10px] tracking-widest uppercase text-ink/40">
              Its twin at {MUSEUM[twin.src]}
            </span>
            <span className="block truncate text-sm text-ink group-hover:underline">{twin.t}</span>
            <span className="block font-mono text-[10px] text-ink/50">{twin.hex}</span>
          </span>
        </button>
      )}

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
