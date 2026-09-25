import { useEffect, useState } from 'react';

/** A deploy mid-visit breaks lazy chunks; Vite reports it and a reload is offered. */
export function ReloadBanner() {
  const [needsReload, setNeedsReload] = useState(false);

  useEffect(() => {
    const onPreloadError = () => setNeedsReload(true);
    window.addEventListener('vite:preloadError', onPreloadError as EventListener);
    return () =>
      window.removeEventListener('vite:preloadError', onPreloadError as EventListener);
  }, []);

  if (!needsReload) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-3 bg-ground/95 p-2 text-center font-mono text-xs text-ink/80">
      A newer version of this page is available.
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="border border-ink/30 px-3 py-1 hover:text-ink"
      >
        Reload
      </button>
    </div>
  );
}
