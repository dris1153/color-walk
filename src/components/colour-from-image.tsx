import { useCallback, useRef, useState } from 'react';
import { SAMPLE_EDGE, dominantColorFromPixels } from '../lib/image-colour';
import type { HueSelection } from '../lib/color-math';

type Props = {
  onColour: (hue: HueSelection, lightness: number) => void;
};

/**
 * A picture the reader already has becomes a way into the collection. It is read
 * with FileReader and drawn to a canvas here in the page: nothing is uploaded,
 * no request is made, and a data: URL is what the CSP already allows.
 */
export function ColourFromImage({ onColour }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const read = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('unreadable'));
          reader.readAsDataURL(file);
        });

        const img = new Image();
        img.src = dataUrl;
        await img.decode();

        const scale = Math.min(SAMPLE_EDGE / img.width, SAMPLE_EDGE / img.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no canvas');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const colour = dominantColorFromPixels(data);
        if (!colour) {
          setError('Could not read that picture');
          return;
        }
        // A grey picture is not a dead end any more: it lands on the monochrome
        // works, at its own tone.
        onColour(colour.neutral ? 'grey' : colour.hue, colour.lig);
      } catch {
        setError('Could not read that picture');
      }
    },
    [onColour],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="font-mono text-[10px] tracking-widest uppercase text-ink/50 underline decoration-ink/20 underline-offset-4 hover:text-ink hover:decoration-ink/50"
      >
        From a picture
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared so choosing the same file twice still fires a change.
          e.target.value = '';
          if (file) void read(file);
        }}
      />
      {error && (
        <p role="status" className="text-center font-mono text-[10px] text-ink/50">
          {error}
        </p>
      )}
    </>
  );
}
