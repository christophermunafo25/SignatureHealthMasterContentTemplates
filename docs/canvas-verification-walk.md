# Canvas verification walk — ten scenarios

Ported from the upstream editing audit's Phase 5 checklist. Every scenario
below exercises something the rewrite changed and that **no automated test in
this repo covers**, because each needs a real pointer against a real canvas.

**Status: NOT YET WALKED.** The rewrite landed with build, typecheck, and 109
unit tests green, and with the geometry (rotation-aware hit testing, snapping)
under direct test. The interaction itself is unverified — the builder needs an
admin session. Treat this file as the gate before merge, not as a record.

Open a template in the builder, Fields step, and work down.

| # | Scenario | What must happen | ✓ |
|---|---|---|---|
| 1 | **Select and drag in one gesture.** Press on an unselected element and drag straight off without releasing. | It selects AND moves in the one gesture. No second click needed. | ☐ |
| 2 | **Click vs drag threshold.** Click an element with a twitchy hand (under ~3px). | Selects, commits nothing, and adds no undo entry. | ☐ |
| 3 | **Fast jump-drag.** Drag an element quickly enough that the pointer leaves the box. | The element keeps following the pointer; capture holds. | ☐ |
| 4 | **Release outside the window.** Drag an element past the browser edge and release there. | Commits at the visibility clamp (≥24 canvas px still on canvas). No stuck drag, no element lost. | ☐ |
| 5 | **Escape mid-drag.** Start a drag, press Escape before releasing. | The drag cancels, geometry reverts, **the selection is kept**, and the builder's Escape-deselects shortcut does NOT also fire. | ☐ |
| 6 | **Window blur mid-drag.** Start a drag and Cmd-Tab away. | The gesture cancels cleanly, nothing commits, and the canvas is usable on return. | ☐ |
| 7 | **Rotated resize.** Rotate an element ~30°, then drag a corner. | It resizes along its OWN axes; the opposite corner stays pinned; no origin drift. | ☐ |
| 8 | **Min-size clamp and pick-up.** Drag a side handle inward past the minimum, then back out without releasing. | The box stops at 16px, then picks the edge back up as the cursor returns. No jump at release. | ☐ |
| 9 | **Side handles on a standard text row.** Select a 480×90 text field at fit zoom. | The whole border is grabbable even though the box is ~22 screen px tall. (This is the defect the upstream walk found: handle-thinning had hidden the side handles.) | ☐ |
| 10 | **Viewport resize while zoomed.** Zoom to ~200%, then resize the browser window. | The anchor point stays put and the cursor tracks pixel-exact afterwards. | ☐ |

## Also worth a pass, new in this phase

| Scenario | What must happen | ✓ |
|---|---|---|
| Alt-click through a stack | Each alt-click digs one layer deeper, wraps at the bottom, and can drag in the same gesture. | ☐ |
| Double-click a FIXED text element | Opens in-place editing, same face/size/alignment — nothing shifts on entry or exit. Enter or blur commits ONE undo entry; Escape reverts. | ☐ |
| Double-click a MEMBER-EDITABLE element | Focuses the inspector's Name field instead (the only text an admin owns there). | ☐ |
| Smart guides | Dragging near another element's edge or centre snaps and shows the line. Holding Cmd/Ctrl suppresses it. | ☐ |
| No grid | Nothing quantises to 10px any more; positions are free between guides. | ☐ |
| Shift while moving | Locks to the dominant axis; releasing shift mid-drag frees both again. | ☐ |
| Arrow nudge | 1px, Shift 10px. A rapid burst is ONE undo entry; spaced presses are separate. | ☐ |
| Undo after a drag | The whole drag undoes as a single step, and the changed elements are re-selected. | ☐ |
| Zoom | Ctrl/Cmd+wheel zooms about the pointer; Cmd+/Cmd- step; Cmd+0 fits. Range 1×–8×. | ☐ |
| Resize does NOT scale font | Corner-drag a text element: the box changes, the font size does not. (Shrink/fill still re-derive their DISPLAYED size from the new box.) | ☐ |

## Regression gate

The full §5 gate still applies on top of this — in particular item 12: open a
published template, change nothing, save, reopen. If a no-op save-and-reopen
moves a single pixel, this phase has a rounding regression and must not merge.
