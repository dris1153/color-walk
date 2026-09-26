import { useEffect, useState } from 'react';

/**
 * The page as people with colour-vision deficiencies see it. Machado, Oliveira
 * and Fernandes (2009), severity 1.0, for linear RGB, which is the space SVG
 * filters work in by default. Applied as a CSS filter on the root element: it
 * reaches the museums' images too without reading a pixel, and on the root it
 * does not become the containing block of the fixed controls and overlay.
 */
const MATRICES = {
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
  achromatopsia: [0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722],
} as const;

type Vision = keyof typeof MATRICES;

const OPTIONS: readonly [Vision | '', string][] = [
  ['', 'Normal vision'],
  ['protanopia', 'Protanopia (no red)'],
  ['deuteranopia', 'Deuteranopia (no green)'],
  ['tritanopia', 'Tritanopia (no blue)'],
  ['achromatopsia', 'Achromatopsia (no colour)'],
];

/** A 3x3 matrix as feColorMatrix's 4x5, alpha passed through. */
const values = (m: readonly number[]) =>
  [0, 1, 2].map((r) => `${m[r * 3]} ${m[r * 3 + 1]} ${m[r * 3 + 2]} 0 0`).join(' ') + ' 0 0 0 1 0';

export function VisionControl() {
  const [vision, setVision] = useState<Vision | ''>('');

  useEffect(() => {
    const root = document.documentElement;
    root.style.filter = vision ? `url(#cw-vision-${vision})` : '';
    return () => {
      root.style.filter = '';
    };
  }, [vision]);

  return (
    <>
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          {Object.entries(MATRICES).map(([name, m]) => (
            <filter key={name} id={`cw-vision-${name}`}>
              <feColorMatrix type="matrix" values={values(m)} />
            </filter>
          ))}
        </defs>
      </svg>
      <select
        aria-label="See the collection as"
        value={vision}
        onChange={(e) => setVision(e.target.value as Vision | '')}
        className={`border bg-ground px-2 py-1.5 font-mono text-[11px] tracking-widest uppercase hover:border-ink/50 hover:text-ink ${vision ? 'border-ink/60 text-ink' : 'border-ink/20 text-ink/70'}`}
      >
        {OPTIONS.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </>
  );
}
