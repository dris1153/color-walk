/**
 * Pages loaded (page 0 included) before a filtered grid stops fetching by
 * itself. The orange bucket runs to ~100 pages; a rare combination must not
 * quietly pull all of them, so past this the reader is asked.
 */
export const AUTO_PAGES = 8;

type SearchState = {
  filtering: boolean;
  ready: boolean;
  pageFailed: boolean;
  /** Matches found so far, and how many the grid wants to show. */
  found: number;
  wanted: number;
  more: boolean;
  loaded: number;
  limit: number;
};

/** Whether a page may be fetched without the reader asking: always when
 *  unfiltered (the reader scrolled), within the budget when filtered. */
export const mayFetch = ({ filtering, loaded, limit }: Pick<SearchState, 'filtering' | 'loaded' | 'limit'>): boolean =>
  !filtering || loaded < limit;

/** A filtered grid short of what it wants keeps fetching on its own, until the
 *  budget runs out or a page fails; either way the reader is then asked. */
export const isSearching = (s: SearchState): boolean =>
  s.filtering && s.ready && !s.pageFailed && s.found < s.wanted && s.more && mayFetch(s);
