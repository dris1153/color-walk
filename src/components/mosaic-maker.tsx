import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { loadMosaic, type Mosaic, type MosaicTile } from '../lib/mosaic-client';
import { MOSAIC_COLS, gridRows, matchCells } from '../lib/mosaic-match';
import { rgbToLab, type Lab } from '../lib/lab';
import { pixelsAt, readImageFile } from '../lib/read-image-file';
import { loadEntry, type Item } from '../lib/color-index-client';

type Props = { onOpen: (item: Item) => void; onClose: () => void };
type Picture = { rows: number; rgb: [number, number, number][]; picks: number[] };

/** Drawn size of a cell; 64 columns make a 1,024 px wide picture. */
const CELL = 16;
const MAX_TINT = 40;
const LINK = 'font-mono text-[11px] tracking-widest uppercase text-ink/60 underline underline-offset-4 hover:text-ink';

/**
 * The reader's picture rebuilt from works in the collection. Matched in this
 * browser against an atlas this site serves, so nothing is uploaded and the
 * result can be saved. Tint is off by default: the tiles are the works' real
 * colours, and a bright blue sky honestly comes out grey-blue.
 */
export function MosaicMaker({ onOpen, onClose }: Props) {
  const [mosaic, setMosaic] = useState<Mosaic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picture, setPicture] = useState<Picture | null>(null);
  const [tint, setTint] = useState(0);
  const [hovered, setHovered] = useState<MosaicTile | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let stale = false;
    loadMosaic().then(
      (m) => !stale && setMosaic(m),
      () => !stale && setError('Could not load the mosaic tiles.'),
    );
    return () => {
      stale = true;
    };
  }, []);

  const make = async (file: File) => {
    if (!mosaic) return;
    setError(null);
    setBusy(true);
    try {
      const img = await readImageFile(file);
      // Matching holds the main thread for about a second; let "Matching" paint first.
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      const rows = gridRows(img.width, img.height);
      const data = pixelsAt(img, MOSAIC_COLS, rows);
      const rgb: [number, number, number][] = [];
      const cells: Lab[] = [];
      for (let i = 0; i < data.length; i += 4) {
        rgb.push([data[i]!, data[i + 1]!, data[i + 2]!]);
        cells.push(rgbToLab(data[i]!, data[i + 1]!, data[i + 2]!));
      }
      setPicture({ rows, rgb, picks: matchCells(cells, mosaic.tiles.map((t) => t.l)) });
    } catch {
      setError('Could not read that picture.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !mosaic || !picture) return;
    canvas.width = MOSAIC_COLS * CELL;
    canvas.height = picture.rows * CELL;
    picture.picks.forEach((tile, i) => {
      const x = (i % MOSAIC_COLS) * CELL;
      const y = Math.floor(i / MOSAIC_COLS) * CELL;
      const sx = (tile % mosaic.cols) * mosaic.tile;
      const sy = Math.floor(tile / mosaic.cols) * mosaic.tile;
      ctx.drawImage(mosaic.atlas, sx, sy, mosaic.tile, mosaic.tile, x, y, CELL, CELL);
      if (tint > 0) {
        const [r, g, b] = picture.rgb[i]!;
        ctx.fillStyle = `rgba(${r},${g},${b},${tint / 100})`;
        ctx.fillRect(x, y, CELL, CELL);
      }
    });
  }, [mosaic, picture, tint]);

  const tileAt = (e: MouseEvent<HTMLCanvasElement>): MosaicTile | null => {
    const canvas = canvasRef.current;
    if (!canvas || !mosaic || !picture) return null;
    const rect = canvas.getBoundingClientRect();
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * MOSAIC_COLS);
    const row = Math.floor(((e.clientY - rect.top) / rect.height) * picture.rows);
    const pick = picture.picks[row * MOSAIC_COLS + col];
    return pick === undefined ? null : (mosaic.tiles[pick] ?? null);
  };

  const open = async (tile: MosaicTile | null) => {
    const item = tile ? await loadEntry(tile.b, tile.p, tile.id).catch(() => null) : null;
    if (item) onOpen(item);
  };

  const save = () =>
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'color-walk-mosaic.png';
      a.click();
      // Revoked a moment later: some browsers start the download after this tick.
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');

  const distinct = picture ? new Set(picture.picks).size : 0;

  return (
    <section className="mx-auto flex max-w-5xl flex-col items-center gap-4 py-4" aria-label="Your picture in museum works">
      <p className="text-center font-mono text-xs tracking-widest uppercase text-ink/70">
        Your picture, made of museum works. It is matched in this browser; nothing is uploaded.
      </p>
      <button type="button" disabled={!mosaic || busy} onClick={() => inputRef.current?.click()} className="border border-ink/30 px-4 py-2 font-mono text-xs tracking-widest uppercase text-ink/80 hover:text-ink disabled:opacity-40">
        {!mosaic ? 'Loading tiles' : busy ? 'Matching' : 'Choose a picture'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // so choosing the same file again still fires
          if (file) void make(file);
        }}
      />
      {error && <p role="status" className="font-mono text-xs text-ink/50">{error}</p>}
      {picture && (
        <>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`Your picture, made of ${distinct} museum works`}
            onMouseMove={(e) => setHovered(tileAt(e))}
            onMouseLeave={() => setHovered(null)}
            onClick={(e) => void open(tileAt(e))}
            className="h-auto w-full max-w-[1024px] cursor-pointer"
          />
          <p className="min-h-5 font-mono text-[11px] text-ink/60" aria-live="polite">
            {hovered ? `${hovered.t} - click to open` : `${distinct} different works. Point at one to see what it is.`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <label className="flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase text-ink/60">
              Tint
              <input type="range" min={0} max={MAX_TINT} step={5} value={tint} onChange={(e) => setTint(Number(e.target.value))} />
              {tint}%
            </label>
            <button type="button" onClick={save} className={LINK}>
              Save as PNG
            </button>
          </div>
        </>
      )}
      <button type="button" onClick={onClose} className={LINK}>
        Back to browsing
      </button>
    </section>
  );
}
