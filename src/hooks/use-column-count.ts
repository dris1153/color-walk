import { useEffect, useState } from 'react';

const BREAKPOINTS = [
  { query: '(min-width: 1440px)', columns: 5 },
  { query: '(min-width: 1024px)', columns: 4 },
  { query: '(min-width: 640px)', columns: 3 },
] as const;

const measure = () =>
  BREAKPOINTS.find((b) => window.matchMedia(b.query).matches)?.columns ?? 2;

export function useColumnCount(): number {
  const [columns, setColumns] = useState(measure);

  useEffect(() => {
    const lists = BREAKPOINTS.map((b) => window.matchMedia(b.query));
    const update = () => setColumns(measure());
    for (const list of lists) list.addEventListener('change', update);
    update();
    return () => {
      for (const list of lists) list.removeEventListener('change', update);
    };
  }, []);

  return columns;
}
