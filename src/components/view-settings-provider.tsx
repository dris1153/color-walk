import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_VIEW, readViewSettings, writeViewSettings, type ViewSettings } from '../lib/view-settings';

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

/** A 3x3 matrix as feColorMatrix's 4x5, alpha passed through. */
const values = (m: readonly number[]) =>
  [0, 1, 2].map((r) => `${m[r * 3]} ${m[r * 3 + 1]} ${m[r * 3 + 2]} 0 0`).join(' ') + ' 0 0 0 1 0';

type Context = { settings: ViewSettings; update: (next: Partial<ViewSettings>) => void };
const ViewSettingsContext = createContext<Context>({ settings: DEFAULT_VIEW, update: () => undefined });

export const useViewSettings = (): Context => useContext(ViewSettingsContext);

/** Holds the reader's view settings, keeps them in their browser, and applies colour vision to the page. */
export function ViewSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ViewSettings>(readViewSettings);
  const update = useCallback((next: Partial<ViewSettings>) => {
    setSettings((s) => {
      const merged = { ...s, ...next };
      writeViewSettings(merged);
      return merged;
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.filter = settings.vision ? `url(#cw-vision-${settings.vision})` : '';
    return () => {
      root.style.filter = '';
    };
  }, [settings.vision]);

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return (
    <ViewSettingsContext.Provider value={value}>
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          {Object.entries(MATRICES).map(([name, m]) => (
            <filter key={name} id={`cw-vision-${name}`}>
              <feColorMatrix type="matrix" values={values(m)} />
            </filter>
          ))}
        </defs>
      </svg>
      {children}
    </ViewSettingsContext.Provider>
  );
}
