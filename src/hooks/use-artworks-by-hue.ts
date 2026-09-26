import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hueToBucket, rankPages, type HueSelection } from '../lib/color-math';
import { hasMorePages, loadBucketNear, loadBucketPage, type Item } from '../lib/color-index-client';
import { isFiltering, matchesFilter, type Filter } from '../lib/facets';
import { AUTO_PAGES, isSearching, mayFetch } from '../lib/filter-search';
import { withViewTransition } from '../lib/view-transition';

export type LoadStatus = 'loading' | 'ready' | 'error';

const REVEAL_STEP = 60;
/**
 * Rows revealed on a fresh hue. Cards below the fold still get fetched, because
 * Chrome's lazy-load threshold is thousands of pixels on a slow connection, so
 * a fixed 60 made a two-column phone pull ~40 museum images to show four.
 * Twelve rows keeps the desktop behaviour identical at five columns.
 */
const INITIAL_ROWS = 12;
const BACKOFF_MS = [2000, 4000, 8000];
const IMAGE_ERROR_LIMIT = 8;

export function useArtworksByHue(
  hue: HueSelection,
  tone: number | null,
  columns: number,
  filter: Filter,
) {
  const bucket = typeof hue === 'number' ? hueToBucket(hue) : hue;
  // Monochrome works have no hue, so only the tone axis ranks them.
  const targetHue = typeof hue === 'number' ? hue : null;
  const initialReveal = columns * INITIAL_ROWS;
  // One entry per loaded page. Pages are sorted independently and concatenated,
  // never merged, so an arriving page cannot reorder what is already on screen.
  const [pages, setPages] = useState<Item[][]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [revealCount, setRevealCount] = useState(initialReveal);
  const [retryDisabled, setRetryDisabled] = useState(false);
  const [imageErrors, setImageErrors] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  const [autoLimit, setAutoLimit] = useState(AUTO_PAGES);
  /** The last page fetch failed; the search stops and "Keep looking" retries. */
  const [pageFailed, setPageFailed] = useState(false);
  const filtering = isFiltering(filter);
  const attempt = useRef(0);
  const backoffTimer = useRef<number | undefined>(undefined);
  const loadedPages = useRef(1);
  const fetchingPage = useRef(false);
  /** Whether a grid is already up: the very first fill must paint at once, not
   *  fade in behind a transition that would also cloud the LCP measurement. */
  const hasGrid = useRef(false);
  /** Bumped on every bucket change, so a page that arrives late is discarded
   * instead of appended to whatever hue the reader moved on to. */
  const generation = useRef(0);

  useEffect(() => {
    // A newer hue must win, but the request itself is left to finish and fill
    // the module cache, so returning to this hue costs nothing.
    let stale = false;
    generation.current += 1;
    loadedPages.current = 1;
    fetchingPage.current = false;
    setStatus('loading');
    loadBucketNear(bucket)
      .then((items) => {
        if (stale) return;
        attempt.current = 0;
        const show = () => {
          setPages([items]);
          setStatus('ready');
        };
        // A new bucket arriving replaces the whole grid, so it crossfades too.
        if (hasGrid.current) withViewTransition(show);
        else show();
        hasGrid.current = true;
      })
      .catch(() => {
        if (stale) return;
        setStatus('error');
        setRetryDisabled(true);
        const wait = BACKOFF_MS[Math.min(attempt.current, BACKOFF_MS.length - 1)] ?? 8000;
        attempt.current += 1;
        backoffTimer.current = window.setTimeout(() => setRetryDisabled(false), wait);
      });
    return () => {
      stale = true;
      window.clearTimeout(backoffTimer.current);
    };
  }, [bucket, reloadToken]);

  // The sort key is the exact hue and tone, so it changes only when they do.
  // Tone costs no request: `lig` is already on every item the bucket returned.
  const ranked = useMemo(() => rankPages(pages, targetHue, tone), [pages, targetHue, tone]);
  const items = useMemo(
    () => (filtering ? ranked.filter((item) => matchesFilter(item, filter)) : ranked),
    [ranked, filtering, filter],
  );

  // The single place a sort-key change resets the view: nothing already on
  // screen is ever silently reordered underneath the reader. Keyed on the sort
  // key itself, not on `items`, because appending a page also mints a new array
  // and must not throw the reader back to the top.
  useEffect(() => {
    setRevealCount(initialReveal);
    setImageErrors(0);
    setAutoLimit(AUTO_PAGES);
    setPageFailed(false);
    window.scrollTo(0, 0);
    // Both keys: `bucket` catches a move between all-colours, a hue and the
    // monochrome works; `targetHue` catches a drag inside one bucket, which
    // reorders the grid just as much. A filter changes what is shown as surely.
  }, [bucket, targetHue, tone, initialReveal, filter.kind, filter.era, filter.region]);

  const loadNextPage = useCallback(() => {
    if (bucket === null || fetchingPage.current) return;
    const page = loadedPages.current;
    if (!hasMorePages(bucket, page)) return;
    fetchingPage.current = true;
    const mine = generation.current;
    loadBucketPage(bucket, page)
      .then((next) => {
        if (generation.current !== mine) return;
        fetchingPage.current = false;
        loadedPages.current = page + 1;
        setPageFailed(false);
        setPages((p) => [...p, next]);
      })
      .catch(() => {
        // A failed page leaves the reader on what is already loaded; the next
        // revealMore, or "Keep looking" under a filter, retries it.
        if (generation.current !== mine) return;
        fetchingPage.current = false;
        setPageFailed(true);
      });
  }, [bucket]);

  // pages.length is the pages loaded for this hue: page 0 carries its padding.
  const loaded = pages.length;
  const revealMore = useCallback(() => {
    // Never below the current count: a filtered grid is short by nature, and
    // shrinking the window to it would stop the search for more matches.
    const next = Math.max(revealCount, Math.min(revealCount + REVEAL_STEP, items.length));
    setRevealCount(next);
    // Under a filter the scroll sentinel keeps firing on a short grid, so it
    // is held to the same page budget as the search, or the budget means nothing.
    if (items.length - next <= REVEAL_STEP && mayFetch({ filtering, loaded, limit: autoLimit })) loadNextPage();
  }, [revealCount, items.length, filtering, loaded, autoLimit, loadNextPage]);

  const more = bucket !== null && loaded > 0 && hasMorePages(bucket, loaded);
  const searching = isSearching({
    filtering,
    ready: status === 'ready',
    pageFailed,
    found: items.length,
    wanted: revealCount,
    more,
    loaded,
    limit: autoLimit,
  });
  useEffect(() => {
    if (searching) loadNextPage();
  }, [searching, loaded, loadNextPage]);
  // Asking to keep looking also asks for more matches than are on screen, or a
  // grid already showing all it found would have nothing left to look for.
  const searchMore = useCallback(() => {
    setPageFailed(false);
    setAutoLimit(loaded + AUTO_PAGES);
    setRevealCount((c) => Math.max(c, items.length + REVEAL_STEP));
  }, [loaded, items.length]);

  const retry = useCallback(() => setReloadToken((t) => t + 1), []);
  const noteImageError = useCallback(() => setImageErrors((c) => c + 1), []);
  const noteImageLoad = useCallback(() => setImageErrors(0), []);

  return {
    items,
    revealed: items.slice(0, revealCount),
    status,
    revealMore,
    retry,
    retryDisabled,
    noteImageError,
    noteImageLoad,
    imagesDown: imageErrors > IMAGE_ERROR_LIMIT && revealCount === initialReveal,
    /** Pages of this hue not fetched yet. */
    more,
    /** A filter is fetching further pages by itself. */
    searching,
    searchMore,
  };
}
