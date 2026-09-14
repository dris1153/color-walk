# Brainstorm: scaling the index from 6k to ~90k works

**Date:** 2026-09-14
**Trigger:** "tôi muốn mở rộng ra nhiều data hơn"
**Outcome:** agreed. Page the bucket files first, then rebuild the crawl so it can run for a day across sessions under the owner's control.

## Revisiting an earlier rejection

The v2 brainstorm measured this idea and **rejected it**. That rejection rested on two premises, and both have since changed:

| Premise then | Now |
|---|---|
| A bigger warm bucket is a dead end, because there is no way to navigate inside it | The tone axis exists. That is exactly what it was built for. |
| Filling the cold hues is hopeless, and nobody can see the gaps anyway | The ring shows density. Any bucket that fills is visible immediately. |

What survives the revisit is the third objection, **file size**, and that is the part this design has to solve.

## Which sources actually help

50 works sampled per Met department through the project's own extractor:

| Department | n | Buckets occupied | Largest bucket's share | Cool share | Achromatic |
|---|---|---|---|---|---|
| **Asian Art** | 44 | 8/24 | **0.32** | 0.07 | 6 |
| Modern Art | 42 | 7/24 | 0.43 | 0.05 | 8 |
| Islamic Art | 23 | 5/24 | 0.35 | 0.00 | 0 |
| Photographs | 21 | 3/24 | 0.62 | 0.00 | 0 |
| Costume Institute | 40 | 5/24 | 0.75 | 0.07 | 4 |
| *shipped index* | 6048 | 16/24 | **0.73** | ~0.02 | - |

Asian Art is dramatically flatter than anything measured so far: no single bucket takes more than a third. Costume Institute is as concentrated as what already ships, and Photographs is mostly monochrome.

**Stated weakness of this measurement:** n is small, and these are the *first* N search results rather than a random sample, unlike the CMA sampling which used random offsets. Good enough to rank candidates, not to pin numbers.

## Scope chosen

~90,000 works: all CMA CC0-with-image, plus Met Asian Art, Islamic Art and Modern Art. Met holds 379,386 public-domain works with images in total, so any expansion is a selection; at the WAF-safe 1.25 req/s the whole Met would take 84 days.

## The blocker that only appears at scale

The Met object cache is a **single JSON file rewritten every 50 objects**.

| | |
|---|---|
| Bytes per Met object | 2,370 |
| At 62,600 objects | a **148 MB** file |
| Saves per crawl | 1,252 |
| Total bytes rewritten | **93 GB** |

Worse than the number: near the end, every save has to `JSON.stringify` and write 148 MB, stalling the crawl for seconds at a time, repeatedly. It would grind to a halt long before finishing. At today's 2,721 objects the file is 6.4 MB and nothing shows.

## Design

### Part 1: paged bucket files

The writer sorts each bucket by `pct` and splits into pages of 600:

```
bucket-02.json     { bucket, center, count: 35000, pages: 59, items: [first 600] }
bucket-02-1.json   { bucket, page: 1, items: [next 600] }
```

`count` is the bucket's true total; `items` is only page 0. Nothing is capped and no work is dropped.

The client fetches page 0. When `revealMore` is about to exhaust what is loaded and pages remain, it fires a background fetch that appends. `revealMore` stays synchronous, so the existing reveal and scroll-reset logic is untouched.

**Deliberate simplification:** only the *primary* bucket pages. Neighbouring buckets, which pad a thin hue, contribute page 0 only. A thin hue has few works by definition, so 600 per neighbour is already more than enough; only the primary bucket can be enormous.

**A phase 2 criterion changes.** "Scrolling a bucket end to end produces zero non-image requests" becomes "one request per 600 items revealed". Measured after building: 302 kB raw, **29 kB brotli**, 43 kB gzip per page. The original was written for a 6,048-work index.

The current index already exercises this: bucket 2 holds 4,407 works, which is 8 pages. Paging can be verified before any crawling happens.

### Part 1, built and measured 2026-09-14

Two things the design above got wrong, both found while writing the client:

1. **The page cursor cannot live in the module.** `loadOneBucket` returns page 0
   from cache without re-fetching, so a module-level "pages loaded" counter would
   survive a return to a hue whose list had been rebuilt from page 0 alone, and
   the pages in between would never be requested again. The cursor belongs to the
   hook that owns the list; the module keeps only `pages`, which is read out of
   the file and therefore cannot drift.

2. **"`revealMore` stays synchronous so the reveal logic is untouched" was wrong.**
   The reset is not triggered by `revealMore`; it is an effect keyed on the
   `items` array, and appending a page mints a new array. A reader at item 600
   would have been thrown back to the top with 60 items showing. Worse, merging
   a new page into one list and re-sorting would reorder cards already on screen
   — the exact thing the comment above that effect promises never happens.

   Fixed by keying the reset on the sort key (`hue`, `tone`) instead of the array
   identity, and by holding the list as **one array per page**, each sorted
   independently and concatenated. Page 0 holds the bucket's highest-`pct` works,
   so a later page ranking below all of page 0 is honest rather than a
   compromise, and nothing above the reader's position can move.

Verified by scrolling bucket 2 end to end at 1440x900:

| Check | Result |
|---|---|
| Works reached | **4,407 of 4,407** |
| Pages fetched | all 8, `bucket-02.json` through `bucket-02-7.json` |
| Duplicate requests | 0 |
| Scroll position thrown backwards | 0 times |
| Page errors | none |
| Per page | 302 kB raw, 29 kB brotli, 43 kB gzip |

Tests 88 (up from 84), build clean.

### Part 2: a crawl the owner can run

- **Append-only JSONL** replaces the rewritten JSON. One line per object, never rewritten. A torn last line from a Ctrl+C is dropped at parse time and everything before it survives. Startup reads once to build a set of known ids, then streams: read a line, normalise it, discard the raw. Peak memory ~31 MB instead of 148 MB.
- Raw API responses stay cached rather than normalised items, so changing the normaliser does not force a re-crawl. That has already happened once this session.
- **Pause** on SIGINT: finish the current item, flush, print where it stopped and the command to continue, exit 0. A second Ctrl+C exits immediately.
- **Progress** written to `progress.json` after each batch, plus `npm run crawl:status` to print it from another terminal without touching the running crawl.
- **Bounded runs** via `--minutes=N`, so "crawl for two hours tonight" needs no supervision.
- **Source selection** via `--met-departments=6,14,21` and `--cma-types=all`, replacing the hardcoded `departmentId=11`.
- **The index is rewritten at the end of every run** from whatever is cached, so the site always reflects the crawl so far rather than needing all 24 hours before it is usable.

### Part 2, built and measured 2026-09-14

#### The Met search will not serve what it counts

The approved plan reached departments through the v1.1 search. It cannot get
what that plan needs: **the endpoint stops serving ids past offset 10,000**,
whatever total it reports.

| Department | search reports | search serves | department listing |
|---|---|---|---|
| Asian Art (6) | 34,217 | **10,000** | 37,320 |
| Islamic Art (14) | 15,231 | **10,000** | 15,755 |
| Modern Art (21) | 13,152 | **10,000** | 15,148 |
| European Paintings (11) | 2,721 | 2,721 | 2,644 |

Built as designed, the crawl would have quietly stopped at ~32,700 Met works
instead of 62,600, with no error to say so.

`/v1/objects?departmentIds=N` has no cap: one request returns the whole id
list, 37,320 for Asian Art, all distinct. It does not filter, so 3-15% of what
it returns is not public domain or has no image - `normalizeArtwork` already
drops exactly those, so the cost is wasted requests, not bad data.

**Neither source is a superset of the other.** European Paintings is the proof:
search has 2,721, the listing has 2,644, and the union is 2,724. Taking either
one alone loses works, so ids come from the union of both.

Date-range partitioning was tried first and rejected: splitting Asian Art into
five date ranges keeps every range under the cap, but the ranges sum to 27,429
of 34,217 because undated works match no range at all.

#### CMA paging drops records

`skip` paging over a live result set is lossy, and `sort` is accepted and then
ignored, so there is no stable order to page. A full pass over the 3,957 CC0
paintings returns **3,956** distinct ids. Four consecutive passes returned the
same 3,956; the missing `2015.591` is still CC0, still a Painting, still has an
image, and still fetches fine by accession number.

So the repeat-pass fix does not close the gap, and four passes are pure waste.
Kept at one retry, which catches a record the shuffle moved, and the residual is
logged rather than chased. The real remedy is the JSONL cache: once a record is
seen it stays seen, which the old rewrite-everything cache could never offer
because CMA was re-fetched from scratch every run.

#### Verified

| Check | Result |
|---|---|
| Legacy cache carried over | 2,721 objects moved into the JSONL, 0 unparseable |
| Rebuild reproduces the shipped index | 6,049 works, met 2,104 / cma 3,945, 21 of 24 bucket files byte-identical |
| `--minutes=1` on an uncrawled department | stopped at 50/9,973, wrote the index, printed the resume command |
| **SIGKILL mid-crawl** | 31 records appended, **0 unparseable lines**, file still newline-terminated |
| Resume after that kill | 31 cached, id list reused, crawl continued |
| `npm run crawl:status` from a second terminal | stage, progress, rate, ETA, resume command |
| Half-finished id search | not cached, so the next run re-searches instead of trusting it |
| Tests / build | 97 tests, clean build |

**Not verified, and why:** a graceful Ctrl+C could not be tested programmatically
on Windows - `child.kill('SIGINT')` terminates the process instead of delivering
a catchable signal, so the handler never runs. What is covered instead: the
handler itself by unit test, the same stop path end to end through `--minutes`,
and durability under the strictly worse SIGKILL. A real Ctrl+C in a terminal
raises a genuine console event, which Node does surface as SIGINT.

#### Revised scope

| | Planned | Reachable |
|---|---|---|
| Met, four departments | 62,600 | **~71,000 objects to fetch**, ~65,000 usable |
| CMA, all CC0 with image | 41,514 | 41,514 |
| Met crawl at 1.25 req/s | ~14 h | **~16 h** |

### Cost

| Stage | Estimate |
|---|---|
| Met, 62,600 objects at 1.25 req/s | ~14 h |
| CMA, 41,514 records | minutes |
| Thumbnails, ~104,000 at ~3/s | ~9.6 h |
| Colour extraction | ~6 min |
| **Total** | **~24 h**, splittable across sessions |

Disk: ~26 GB of thumbnail cache against 592 GB free. Index: ~45 MB committed.

## Considered and rejected

- **Trimming fields to shrink the index.** `src` duplicates the `id` prefix and `pct` is unused at runtime, but together they save ~2 MB of 45. The bytes are dominated by real content: titles, artists, URLs, credit lines. Dropping `pct` would also cost the verifier its check on page ordering, which paging now depends on.
- **Capping each bucket.** Rejected previously and still wrong: it would make most of the collection unreachable, and bucket files are sorted by `pct`, so a cap keeps the most monochrome works and discards the varied ones.
- **Crawling the whole Met.** 84 days at a safe rate, ~150 MB of index, and a sustained multi-day load on a museum's API. Selection is both kinder and architecturally necessary.

## Risks

| Risk | Handling |
|---|---|
| Paging breaks the reveal or scroll-reset logic | Verified against today's bucket 2, which is already 8 pages, before any crawl |
| A crawl interrupted mid-write corrupts the cache | Append-only: a partial line is discarded, everything before it is intact |
| The 90k projection is built on small, non-random samples | Accepted; the crawl writes an index every run, so the real distribution is visible early and the scope can be cut |
| Git grows by ~45 MB per index rebuild | Rebuilds are rare; flagged so it is a known cost |
| 104,000 files in one cache directory | Never enumerated, only stat'ed by path, so it does not degrade |

## Success criteria

- Bucket 2 of the current index splits into 8 pages, and scrolling it end to end still reaches every one of its 4,407 works. **Met 2026-09-14.**
- Killing a crawl with Ctrl+C mid-write loses at most the item in flight, and resuming re-reads the cache without error.
- `npm run crawl:status` reports stage, progress and rate from a second terminal.
- `--minutes=N` stops cleanly and writes a usable index.
- Everything still green: 84 tests, zero CSP violations, CLS 0.
