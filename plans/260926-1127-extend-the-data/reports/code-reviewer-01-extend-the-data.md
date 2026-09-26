# Code review: extending the data

**Date:** 2026-09-26
**Scope:** the uncommitted facet, filter, eras and new-source work (29 modified, 27 new files).
**Reviewer ran:** vitest (304 pass), `tsc -b` (clean), the verifier against the old index (ENOENT on eras.json), scratch probes of the parsers and mappings, curl on both IIIF services.

## Findings and what happened to each

| # | Finding | Outcome |
|---|---|---|
| H1 | The scroll sentinel re-fires `revealMore` on a short filtered grid and fetches past the 8-page budget, up to a whole bucket | **Fixed.** `revealMore` is held to the budget through `mayFetch`; browser: 8 requests, 4 scrolls add none, "Keep looking" adds exactly 8 |
| H2 | "Keep looking" does nothing once the window has caught up with the matches | **Fixed.** `searchMore` also raises the wanted count |
| H3 | A failed page leaves "Looking further" on screen forever | **Fixed.** `pageFailed` stops the search; "Keep looking" retries |
| H4 | The committed index had no facets and no eras.json | **Fixed.** Rebuilt; verifier OK; a missing eras.json now fails through `fail()` |
| M1 | `yearFromText` missed "1670s", "early 1600s", and signed BCE wrongly | **Fixed.** Decades, centuries, per-number era markers; tests |
| M2 | Old CMA records could bring back works the fresh CC0 pass no longer returns | **Fixed.** The old cache speaks only for ids and types the new one has not reached |
| M3 | An OAI error parsed as a clean end of set | **Fixed.** Throws, except `noRecordsMatch`; a set cut short is logged and the others continue |
| M4 | Region followed pattern order, so Chinese export ware was "Americas" | **Fixed.** Earliest match in the text wins |
| L1 | "silkscreen" read as silk, "glazes on canvas" as ceramic | **Fixed** |
| L2 | Byte chunks split a multi-byte character; a torn quote made a row | **Fixed** with a streaming `TextDecoder`; torn row dropped |
| L3 | EDM parser: attribute order, entity-encoded resources, rights from a WebResource | **Fixed** the three that matter; CDATA left (the feed has none) |
| L4 | CSP allowed all of `api.nga.gov` | **Fixed.** Narrowed to `https://api.nga.gov/iiif/` |
| L5 | One extra page on a filter change | Left: one page, bounded |
| L6 | Comment said 8 extra pages, meant 8 loaded | **Fixed** (moved to `filter-search.ts`) |
| L7 | `--limit` per cache file; `--refresh-ids` re-downloads NGA CSVs | Left; documented |
| L8 | "1900s" ran to 2099, and 2100 fell outside every era | **Fixed.** "Since 1900", to 2101 |
| L9 | Native selects had no pointer cursor | **Fixed** in the global base rule |
| L10 | Era counts are by lead hue, the grid lists every palette hue | Left: by design, counts a work once |
| L11 | Duplicated bucket function in the eras writer | **Fixed** |
| L12 | A facet-only fragment on `/c/210` dropped the page's hue | **Fixed.** The fragment narrows the page colour |
| L13 | NGA `art-object-page` URLs unverified (403 to curl) | **Verified** in headless Chrome: redirects to `/artworks/46159-marchesa-brigida-spinola-doria` |
