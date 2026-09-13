import { useCallback, useEffect, useState } from 'react';
import { readFavourites, toggleIn, writeFavourites } from '../lib/favourites-store';
import type { Item } from '../lib/color-index-client';

export function useFavourites(): {
  favourites: Item[];
  isSaved: (id: string) => boolean;
  toggle: (item: Item) => void;
} {
  const [favourites, setFavourites] = useState<Item[]>(readFavourites);

  // Writing from an effect rather than inside the updater keeps the updater
  // pure, which matters because StrictMode invokes it twice in development.
  // The write on mount is deliberate: it prunes anything the read rejected.
  useEffect(() => {
    writeFavourites(favourites);
  }, [favourites]);

  const toggle = useCallback((item: Item) => {
    setFavourites((current) => toggleIn(current, item));
  }, []);

  const isSaved = useCallback(
    (id: string) => favourites.some((i) => i.id === id),
    [favourites],
  );

  return { favourites, isSaved, toggle };
}
