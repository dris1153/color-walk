# Brainstorm: breaking out of "one work, one colour"

**Date:** 2026-09-15
**Trigger:** "bo sung tinh nang ... dot pha ra khoi loi mon hien tai"
**Outcome:** three features approved and built: colour twins across museums,
search by arrangement, the colour of a word. Verified on patched indexes; the
real-index numbers wait on a rebuild the owner's crawl is still blocking.

## The groove

Every feature so far ran on one mechanism: a work is one point in colour space,
sorted by distance to what the reader asked for. Wheel, tone, walk, games,
collection ring - all variations of it. Unused: titles, where colour sits in the
frame, the fact that there are two museums, and any relation between two works.

## Measured before choosing

| Idea | Measurement | Verdict |
|---|---|---|
| **Twins across museums** | 385 Met works sampled: nearest CMA work at p50 distance **1.2**, **91% within 5**. Pairs are surprising: *Disk with dragons* / *Trees on a Rocky Hillside*, one hex. | **Strongest.** A relation between works, which the site never had. |
| Arrangement search (3x3) | 1,200 works: **33%** vary >30 degrees across cells, **11%** have a top unlike their bottom. | Viable for a third of the collection; most painted grids will be empty. Built with the count shown first. |
| The colour of a word | 193 words with >=40 works; the twelve most "distinct" all lean red-vs-orange; *buddha*, *garden* look like the whole collection. | **Shallow.** Owner chose it anyway; built as the smallest thing that answers the question (~10 kB, no work lists) so it is cheap to drop. |

## Built

### Twins
- Build: `write-twins.mjs` pairs every primary entry with its nearest primary at the other museum **within the same bucket**; stores `twin: { id, bucket, page }` (~20 B).
- A retraction: "always already loaded, no request" was wrong for paged buckets; hence `page`, so opening costs at most one fetch.
- Twins are drawn from primaries only: a copy filed for a lesser colour must not stand in for a work that leads with it.
- Overlay shows the twin with museum, title, hex; click opens it.
- **Found and fixed:** opening a work from inside the overlay pushed a second detail entry, and Back showed the wrong work. The item now rides in `history.state` and Back/Forward restore it. Consequence: Forward now reopens the overlay with the right work - the old check expected it not to.

### Arrangement
- `extract-composition.mjs`: 3x3 (hue, lightness) map per work, resized to *fill* so the grid maps the whole frame.
- `composition.json` keeps only works whose map varies, with title/thumb/hex/museum and where the full entry lives.
- UI: twelve-hue brush, paint cells, live count, top 60, open with one fetch.

### Words
- `write-words-file.mjs`: per word (>=4 letters, not a stop word, >=40 works) a 24-bucket histogram; monochrome works excluded.
- UI: type, pick, see a log-scaled ring, click a hue to browse it.
- **Found before shipping:** `ringSegments` skips empty buckets, so segment index != bucket; clicking would have jumped to the wrong hue. `RingSegment` now carries `bucket`.

## Verified (patched indexes, real index pending)

| Check | Result |
|---|---|
| Twin card, same page | shown, **0 extra fetches**, click opens twin, its twin points back |
| Back from a twin | returns to the work it was opened from |
| Arrangement: orange top / orange top+bottom / orange over blue | 300 / **0** / 300 |
| Open a result | right work, 0 fetches |
| Words: "drag" | dragon 60, dragons 58; thickest segment click -> `#h=15`, Vermilion |
| app.tsx | 206 -> **191** after `ActivityLinks` + `ActivityView` |
| Tests / CSP / CLS / overlay matrix | **239** / 0 / 0 / 8 of 8 |

**Not yet verified:** twin p90 on the real index, real composition/word counts, and
the verifier over real `twin`/`composition.json`/`words.json`. The owner's two
crawls (started 22:39 and 23:04 on 2026-09-15, running concurrently) own
`public/index`; both loaded pre-spine code and will overwrite it on exit. One
`npm run build:index` afterwards produces every side file and answers these.
