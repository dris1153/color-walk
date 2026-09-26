# Brainstorm: extending the data

**Date:** 2026-09-26
**Trigger:** "giúp tôi brainstorm và extend data cho project này"
**Outcome:** approved in full: depth on the existing works (year, kind, region,
an eras view), Met keyword queries plus the Egyptian department, Rijksmuseum
ceramics and paintings, NGA paintings and sculpture. Built; the owner runs the
long Met crawl.

## The finding that set the direction

Cold colours are not at a museum, they are in a kind of object. Paintings,
prints and paper measure brown and amber everywhere; blue lives in glazes,
faience and enamel. Every probe below used the project's own extractor on real
thumbnails.

| Source | Sampled | Cold (hue 60-330) | Note |
|---|---|---|---|
| Met departments not yet crawled | 60 each, 15 depts | 0-16% | Egyptian 16%, Cloisters 10%, Medieval 10%, the rest 0-5% |
| Met `q=turquoise` | 37 | **46%** | 4,859 of 6,606 ids not cached |
| Met `q=faience` | 33 | **42%** | 3,745 of 3,815 not cached |
| Met `q=enamel` | 37 | 14% | 7,236 of 9,478 not cached |
| Met `q=porcelain` | 37 | 3% | white porcelain reads as grey |
| NGA, random open-access | 200 | 1.5% | 63,827 works, 60% prints and drawings |
| Rijksmuseum paintings | 50 | 2% | 98% public domain |
| Rijksmuseum kraak porcelain | 40 | **73%** | 423 works |
| Rijksmuseum Delftware / tin-glaze | 40 each | **53%** | 1,515 / 1,843, overlapping |
| Rijksmuseum Middle East ceramics | 40 | 30% | 286 works |
| Lower palette threshold 10% -> 5% | 3,000 cached | +1.5% entries | would file 95%-orange works under blue; rejected |

Purple and green stay thin: no source measured has much of either.

## Sources, as measured

- **Met:** Imperva WAF, ~1.25 req/s, search capped at 10,000 ids per query.
  Keyword queries reach across departments for the cold materials.
- **Rijksmuseum:** OAI-PMH EDM, no key, **50 works per request** with image,
  rights and date in the record. 846k records in all; curated sets pick the
  ceramics. The feed serves in-copyright images too (InC), so rights are
  checked per record. Images on `iiif.micr.io`, CORS open, cached a year.
- **NGA:** CSVs on GitHub (objects 82 MB, images 89 MB, plus two constituent
  files), no key, IIIF on `api.nga.gov` with CORS. Paintings and sculpture only.
- The researcher's shortlist (Rijksmuseum, NGA, Getty) put Rijksmuseum first
  for size; measurement put it first for kraak and Delft instead.

## Depth, as measured

- Met cache: `objectBeginDate/EndDate` 100%, `classification` 100% (143 values,
  top 12 = 74%), `culture` 53%. 32% of works span more than 100 years.
- CMA: `creation_date_earliest/latest` ~99%, `culture` ~99%, but the cache did
  not ask for them: a second cache file, refetched (~84 requests).
- After mapping: Met 48,371 works, 26 undated, 658 without a region, 5% "other".

## Built

- Facets `y`/`k`/`r` from `facet-tables.mjs` onto `src/lib/facets.json` (12
  kinds, 9 regions, 12 eras). A decisive department wins over the words
  ("Egypt" is Cairo in Islamic Art and Thebes in Egyptian Art).
- `eras.json`: per era, works by lead hue plus monochrome; the Eras activity
  draws one band per era.
- Gallery: three native selects in the hash; a filtered grid fetches up to 8
  more pages by itself, then asks. Chips in the detail overlay browse "more of
  this kind / era / region in this colour".
- Met `--met-queries=`; Rijksmuseum `--rijks-sets=`; NGA `--nga-classes=`;
  `--source=` a list, defaulting to all four.
- IIIF: Rijksmuseum and NGA `big` is `info.json`; the zoom viewer walks tiles.
  CSP `img-src` and `connect-src` gained both hosts.

## Risks

- Region is heuristic; unmapped works are simply unfilterable by region.
- Filtering a hot bucket is client-side over pages of 600: rare combinations
  stop after 8 pages and ask.
- Index growth: +~35k works, 84 MB -> ~130 MB in git.

## Verified (2026-09-26, rebuilt from the Met and CMA caches)

| Check | Result |
|---|---|
| Index | 70,767 works in 128,855 places, 19,090 monochrome; verifier OK; 86 MB (was 84) |
| Facet coverage | Met: 26 undated, 1.4% no region, 5.1% "other" kind. CMA (refetched): 1.0% undated, 0.6% no region |
| Eras | 89,402 dated across 12 eras, 455 undated. Cold works per era 85-1,009; before 1000 BCE shows the faience cyan |
| `#h=210`, kind Ceramic, then 1600s | hash `#h=210&k=ceramic&e=1600`, 60 cards each step; Back restores both selects |
| Detail chips on a 1600s ceramic | Ceramic / 1600s / East Asia; region chip lands on `#h=210&l=35&r=east-asia`, overlay closed |
| Eras band (blue, 1600s) | `#h=195&e=1600`, 60 cards |
| Shared link `#h=30&k=textile&r=west-asia` | selects restored, 60 cards |
| Near-empty filter (photo, Oceania, orange) | 8 page requests, then "No matches yet / Keep looking"; 4 scrolls add 0; Keep looking adds 8 |
| IIIF under the production CSP | Rijksmuseum and NGA: info.json 200, tiles 200 (NGA 27), 0 CSP violations, no "Load full resolution" prompt |
| Rijksmuseum / NGA fetchers | 100 kraak records (9 of 12 sampled blue, 211-220), 40 NGA paintings; all normalised, thumbnails 12/12 each |
| Tests | 316 (from 267) |

The Rijksmuseum and NGA smoke records are in the caches but not in the
committed index: that rebuild ran with `--source=met,cma`. The owner's crawl
brings all four in.
