---
phase: 3
title: "Heap-snapshot leak check"
status: pending
priority: P3
effort: "1h"
dependencies: [2]
---

# Phase 3: Heap-snapshot leak check

## Context Links
- [v1 phase 3](../260912-2335-free-public-apis-project-ideas/phase-03-deep-zoom-detail-overlay.md) - records the current check and its own caveat that a heap snapshot would be stronger
- CDP HeapProfiler: https://chromedevtools.github.io/devtools-protocol/tot/HeapProfiler/

## Overview
Replace the leak proxy with a real measurement. v1 counts `<canvas>` elements and OpenSeadragon containers left in the DOM after 20 open/close cycles; both return to zero, which proves `destroy()` ran but says nothing about detached nodes the garbage collector still cannot reclaim.

Runs last because its value is checking the overlay *after* phase 2 adds state and a new listener to it.

## Key Insights
- **DOM counting cannot see a leak.** A retained `HTMLCanvasElement` held by a closure is detached from the document and invisible to `querySelectorAll`, which is exactly the shape an OpenSeadragon teardown bug would take.
- **The tool stays out of the project.** This is a diagnostic, not a build step. It lives in the scratchpad and uses the Puppeteer already vendored with the chrome-devtools skill, so `package.json` and the lockfile are untouched.
- **A snapshot needs a forced GC to mean anything.** Without `HeapProfiler.collectGarbage` the count includes objects that were merely not collected yet, and the result is noise.

## Requirements

### Functional
- F1. Drive a real Chrome, open and close 20 different works, force GC, take before and after heap snapshots.
- F2. Count `HTMLCanvasElement` and OpenSeadragon viewer instances by constructor name in each snapshot.
- F3. Report both counts and the delta, and exit non-zero if the delta exceeds 1.
- F4. Run against the built bundle served with production headers, the same surface every other check uses.

### Non-functional
- No change to `package.json`, `package-lock.json` or any project file.
- The script is self-contained and re-runnable.

## Architecture
Scratchpad script, roughly 80 lines:

1. Launch Chrome through the vendored Puppeteer, open a CDP session.
2. `HeapProfiler.enable`, then `collectGarbage`, then `takeHeapSnapshot` with `reportProgress: false`, collecting the chunked JSON from `HeapProfiler.addHeapSnapshotChunk`.
3. Parse the snapshot's `nodes` array against `strings` and `snapshot.meta.node_fields` to count nodes whose name matches the constructors of interest. The format is documented and stable enough for a counting pass; no library needed.
4. Open and close 20 works via the same selectors the v1 overlay check uses.
5. `collectGarbage` again, second snapshot, compare.

Counting by constructor name is deliberately coarse. The question is "did 20 viewers leave 20 canvases behind", and a count answers that without needing retainer-path analysis.

## Related Code Files
- Create: scratchpad only, no project file
- Modify: [v1 phase 3](../260912-2335-free-public-apis-project-ideas/phase-03-deep-zoom-detail-overlay.md) - replace the DOM-count row in its results table with the measured heap numbers, and drop the "not verified here" caveat about heap counting
- Delete: none

## Implementation Steps
1. Build, then serve `dist/` with `public/_headers` applied.
2. Write the snapshot capture and the node-counting pass; verify the parser on a single baseline snapshot before wiring the cycles.
3. Add the 20 open/close cycles between the two snapshots.
4. Run it. If the delta exceeds 1, investigate before touching anything else: that is a real finding, not a threshold to relax.
5. Record the numbers in v1's phase 3 file and remove the caveat it carries.

## Success Criteria
- [ ] The script reports `HTMLCanvasElement` counts before and after with a forced GC on both sides.
- [ ] The delta after 20 open/close cycles is within 1 of baseline.
- [ ] It runs against the production bundle with real headers, not the dev server.
- [ ] `git status` shows no project file changed by running it.
- [ ] v1's phase 3 file carries the measured numbers and no longer claims heap counting was skipped.

## Risk Assessment
| Risk | L x I | Mitigation |
|---|---|---|
| The heap snapshot format is awkward to parse by hand | Med x Low | Only a count is needed, using the documented `node_fields` and `strings` tables; no retainer paths |
| A real leak is found late in the plan | Low x High | That is the point of the check. If found, it is a v1 defect and gets its own fix before v2 ships |
| Snapshot noise makes the delta flaky | Med x Med | Force GC on both sides, compare like for like, and re-run before believing a non-zero delta |
| The check drifts into a project dependency | Low x Med | Scratchpad only; step 4 of the success criteria asserts a clean `git status` |
