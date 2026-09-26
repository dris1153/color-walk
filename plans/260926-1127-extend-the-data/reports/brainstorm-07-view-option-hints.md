# Brainstorm: explaining the View options

**Date:** 2026-09-26
**Trigger:** "thêm tooltip giải thích những này vào giúp tôi" (screenshot of the View panel)
**Outcome:** approved: one hint line per group, with facts, not hover popups.

## Options weighed

| Option | Verdict |
|---|---|
| Hint line under each group: current choice, or the hovered/focused option | **chosen**: works on touch, keyboard, screen readers; ~40 lines |
| ⓘ icon + popover per option | 11 icons, positioning in a 288 px panel at the screen edge, tap handling; ~100 lines |
| Native `title` | ~1 s delay, never on touch or keyboard |
| Text under every option | panel ~2.5x taller, scrolls on a phone |

## Built

- `view-panel.tsx`: each option carries a one- or two-sentence hint (value, label, hint tuples).
  Cards group falls back to "Unticked, the strip and titles show only on hover."
- Hint is `aria-live="polite"`; hover and focus set it, leaving the group or closing the panel resets it.
- Every hint holds two lines (`min-h-[2lh]`): a shrinking hint pulled the next group up
  under the pointer, and Chrome then hovered the option below (seen in the first run).
- Deuteranopia text says "about 1 in 100 men" rather than "the most common kind"
  (the most common deficiency is the milder deuteranomaly).

## Verified (headless Chrome, 1440 px and 390 px)

| Check | Result |
|---|---|
| Default | Normal / Original / Cards fallback text |
| Hover Protanopia, Squint, L | that group's line changes, others keep the current choice |
| Hover all 13 options | legends stay at one set of positions (no shift) |
| Keyboard focus on a checkbox | its hint |
| Escape, reopen | back to current choices |
| Phone tap Squint | Squint hint; panel fits (96 to 384 of 390 px) |
| Page errors | none |
