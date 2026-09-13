---
phase: 2
title: "Favourites in the overlay"
status: pending
priority: P2
effort: "2h"
dependencies: [1]
---

# Phase 2: Favourites in the overlay

## Context Links
- [Brainstorm report](reports/brainstorm-01-tone-axis-and-favourites.md)
- [v1 phase 3](../260912-2335-free-public-apis-project-ideas/phase-03-deep-zoom-detail-overlay.md) - the overlay's focus trap, inert siblings and close matrix, all of which this phase must leave intact
- `localStorage` exceptions: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage

## Overview
Let a reader save a work while looking at it, and browse what they saved. Storage only, no backend, no accounts, no sync.

Exit = saved works survive a reload, a blocked `localStorage` leaves the page fully working, and the overlay's v1 focus and close guarantees still hold.

## Key Insights
- **The card cannot carry the button.** `artwork-card.tsx` renders a `<button>`; HTML forbids nesting one. Adding a save control there means splitting the card into a wrapper plus an inner clickable region, which doubles the grid's tab stops and invalidates the v1 focus verification. The overlay is where a reader is already looking closely, so it is both cheaper and more natural.
- **Store snapshots, not ids.** A saved work may sit in a bucket that is never loaded in a later session. Refetching a whole bucket file to render one card is waste, and the snapshot is ~400-800 bytes.
- **A snapshot is untrusted by the time it is read back.** It has been sitting in a store the user, an extension or another tab can edit. It passes the same gate as an index item before anything renders.
- **`localStorage` throws.** Private mode, blocked site data, quota. Every access is wrapped and the page works without it.

## Requirements

### Functional
- F1. A save toggle in the detail overlay, showing saved or not for the open work.
- F2. Saved works persist across reloads, capped at 200, newest first; saving past the cap drops the oldest.
- F3. A "Saved (n)" toggle switches the grid to the saved list; it is hidden when nothing is saved.
- F4. Touching the hue wheel or the tone slider exits the saved view back to browsing, so neither control is ever dead.
- F5. Every stored item is re-validated on read; anything failing the host allowlist is dropped silently.
- F6. A `localStorage` failure degrades to an in-memory list for the session and never surfaces an error to the reader.

### Non-functional
- No new dependency, no router, no change to `public/_headers`.
- Every file under 200 lines.
- The overlay's v1 guarantees survive: focus returns to the originating card, Tab never escapes, the close matrix still passes.

## Architecture

### Storage
`src/lib/favourites-store.ts`, roughly 70 lines:

```ts
const KEY = 'cw:favourites';
const MAX = 200;

export function readFavourites(): Item[];       // validated, newest first, [] on any failure
export function isFavourite(id: string): boolean;
export function toggleFavourite(item: Item): Item[];  // returns the new list
```
- Reads parse, then keep only entries passing the same checks `color-index-client.ts` applies plus `isAllowedPageUrl(item.page)`.
- Writes `JSON.stringify` the capped list inside `try/catch`; on failure keep the in-memory list and set a module flag so later writes do not retry pointlessly.
- Pure module, no React, so it is unit-testable in the existing node environment.

### State
`src/hooks/use-favourites.ts`, small:
```ts
export function useFavourites(): {
  favourites: Item[];
  isSaved: (id: string) => boolean;
  toggle: (item: Item) => void;
};
```
Seeded from `readFavourites()` once, then held in React state so both the overlay and the grid re-render on change.

### UI
- `artwork-metadata-panel.tsx` gains the save toggle: a `<button>` with `aria-pressed`, sitting with the existing museum link. It is inside the dialog, so it joins the focus cycle; the wrap query already excludes disabled buttons and this one is never disabled.
- `src/components/saved-toggle.tsx`, tiny: renders `Saved (n)` and switches mode. Rendered near the attribution footer, not in the fixed dock, which is already tight after phase 1.
- `app.tsx` holds `mode: 'browse' | 'saved'`. In saved mode the grid's items come from `favourites` instead of `revealed`; `setHue` and `setTone` both reset mode to `browse`.

### What deliberately does not change
The card, the masonry grid, the deep-zoom viewer, the scroll lock, the inert-siblings hook, the history handling. If a diff touches those, the design has drifted.

## Related Code Files
- Create: `src/lib/favourites-store.ts`, `src/hooks/use-favourites.ts`, `src/components/saved-toggle.tsx`, `src/lib/__tests__/favourites-store.test.ts`
- Modify: `src/components/artwork-metadata-panel.tsx`, `src/app.tsx`
- Delete: none

## Implementation Steps
1. Write `favourites-store.ts` and its tests first: round-trip, cap enforcement, newest-first order, a poisoned entry with a foreign host dropped, malformed JSON yielding `[]`, and a throwing `localStorage` stub yielding `[]` without raising.
2. `use-favourites.ts` over the store.
3. Save toggle in the metadata panel with `aria-pressed`.
4. `saved-toggle.tsx` plus the `mode` state in `app.tsx`; wire `setHue` and `setTone` to reset mode.
5. Verify the saved view renders items whose buckets were never loaded this session: save something, reload, open the saved view without touching that hue.
6. Re-run the v1 overlay checks in full: close matrix, focus return, Tab confinement, scroll-lock restore, 20 open/close cycles.
7. Check the private-window path, where `localStorage` access throws.

## Success Criteria
- [ ] Saving a work in the overlay persists across a reload.
- [ ] The saved view renders works whose buckets were not loaded in that session.
- [ ] The 201st save drops the oldest, and the list stays newest-first.
- [ ] A stored entry pointing at a foreign host is dropped on read and never reaches an `<img>` or the viewer.
- [ ] Malformed JSON in the key yields an empty list, not a crash.
- [ ] With `localStorage` throwing, the page loads, browses and opens overlays normally; saving works for the session only.
- [ ] Touching the wheel or the slider exits the saved view.
- [ ] The overlay's v1 checks all still pass unchanged.
- [ ] `npm test` and `npm run build` green; no file over 200 lines.

## Risk Assessment
| Risk | L x I | Mitigation |
|---|---|---|
| The new button breaks the dialog's focus cycle | Med x High | It is a plain enabled `<button>` inside the dialog; the full focus and close matrix is re-run in step 6 |
| A poisoned snapshot points the viewer at an arbitrary host | Low x High | Re-validated on read against the same allowlist as index items, and the overlay already re-checks before use |
| Saved snapshots go stale after an index rebuild | Low x Low | A dead image degrades to the hex fill and the corner mark, exactly like a gallery card |
| Quota exceeded on a small budget | Low x Low | 200 entries, under 200 KB worst case; the write is wrapped and failure is silent |
| Mode state makes the wheel look broken in the saved view | Med x Med | Touching either control exits saved mode, so no control is ever inert |
| Scope creep into card-level saving | Med x Med | Explicitly out; revisit only after the overlay version has been used |
