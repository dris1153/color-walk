/** The museums the index draws from, by the `src` the build stamps on each work. */
export const MUSEUMS = {
  met: 'Metropolitan Museum',
  cma: 'Cleveland Museum',
  rijks: 'Rijksmuseum',
  nga: 'National Gallery of Art',
} as const;

export type Source = keyof typeof MUSEUMS;

export const isSource = (x: unknown): x is Source => typeof x === 'string' && Object.hasOwn(MUSEUMS, x);

/** "the Metropolitan Museum", but "the Rijksmuseum" reads the same way. */
export const museumName = (src: Source): string => `the ${MUSEUMS[src]}`;
