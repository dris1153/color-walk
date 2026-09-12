import { useEffect, useState } from 'react';
import { bucketFileUrl, isAllowedImageUrl } from './lib/image-url';
import { nearestColorName } from './lib/color-name-table';

// Phase 1 smoke only: proves the committed index loads and that both museum
// CDNs serve <img> cross-origin. Phase 2 replaces this file entirely.
type SmokeItem = { id: string; src: 'met' | 'cma'; t: string; thumb: string; hex: string };

const SMOKE_BUCKET = 14;

function Probe({ item }: { item: SmokeItem }) {
  const [state, setState] = useState<'loading' | 'painted' | 'failed'>('loading');
  const allowed = isAllowedImageUrl(item.thumb);

  return (
    <figure className="m-0">
      <div className="h-64 w-64" style={{ backgroundColor: item.hex }}>
        {allowed && (
          <img
            src={item.thumb}
            alt={item.t}
            className="h-full w-full object-cover"
            onLoad={() => setState('painted')}
            onError={() => {
              setState('failed');
              console.error(`smoke: ${item.src} thumbnail failed`, item.thumb);
            }}
          />
        )}
      </div>
      <figcaption className="mt-2 font-mono text-xs">
        {item.src}: {state}
        {!allowed && ' (blocked by allowlist)'}
      </figcaption>
    </figure>
  );
}

export function App() {
  const [count, setCount] = useState<number | null>(null);
  const [probes, setProbes] = useState<SmokeItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(bucketFileUrl(SMOKE_BUCKET))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`http ${res.status}`))))
      .then((data: { count: number; items: SmokeItem[] }) => {
        setCount(data.count);
        const met = data.items.find((i) => i.src === 'met');
        const cma = data.items.find((i) => i.src === 'cma');
        setProbes([met, cma].filter((i): i is SmokeItem => Boolean(i)));
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main className="min-h-screen p-8 font-mono text-sm">
      <h1 className="mb-4 text-2xl">Color Walk - phase 1 smoke</h1>
      <p>
        bucket {SMOKE_BUCKET} ({nearestColorName(SMOKE_BUCKET * 15)}):{' '}
        {error ? `failed - ${error}` : (count ?? 'loading...')}
      </p>
      <div className="mt-6 flex flex-wrap gap-6">
        {probes.map((item) => (
          <Probe key={item.id} item={item} />
        ))}
      </div>
    </main>
  );
}
