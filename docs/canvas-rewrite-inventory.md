# Canvas rewrite — what the editor did before, and must still do

The port plan requires this list before any Phase 4 code is written. It is the
acceptance spec: **the rewrite is done when every item still works, not when
the new code compiles.** `react-moveable` comes out only after the last one is
re-implemented.

Taken from `FieldOverlayEditor.tsx` at 13bb0b6e (489 lines, react-moveable).

## A. Canvas plumbing

| # | Behaviour | Status |
|---|---|---|
| A1 | Scale-to-fit via ResizeObserver: `min(offsetWidth / canvasWidth, 1)` | keep, extended by zoom |
| A2 | Google fonts for every designed typeface load on the edit canvas, not just preview | keep |
| A3 | `toCanvas()` maps screen → canvas px, clamped to canvas bounds | keep |
| A4 | Background painted at canvas scale under everything, `pointerEvents: none` | keep |
| A5 | `data-role="bg"` marks background as empty-canvas for hit purposes | keep |

## B. Selection

| # | Behaviour | Status |
|---|---|---|
| B1 | Pointerdown on a box selects it | keep |
| B2 | Shift / Cmd / Ctrl click toggles a box in or out of the selection | keep |
| B3 | Clicking an already-selected box preserves a multi-selection | keep |
| B4 | Pointerdown on empty canvas clears the selection | keep |
| B5 | Right-click selects an unselected field before opening the menu | keep |
| B6 | Hover state drives the label chip | keep |

## C. Boxes and chrome

| # | Behaviour | Status |
|---|---|---|
| C1 | Boxes at `left/top/width/height = canvas × scale` | keep |
| C2 | Paint order `zIndex = (field.zIndex ?? 0) + 1` — the +1 keeps every box above the background | keep |
| C3 | Rotation rendered as a CSS transform on the box | keep |
| C4 | Selected = solid accent border; unselected = dashed at 65% | keep |
| C5 | Image fields carry their corner radius on the box | keep |
| C6 | Real field content rendered inside via `FieldBoxContent`, canvas-sized then scaled, `pointerEvents: none` | keep |
| C7 | `facility_logo` renders through the same content path with the preview facility | keep |
| C8 | Label chip on hover or selection: label + type, suppressing the type when it duplicates the label; "fixed" always shown | keep |
| C9 | Canvas-space W×H badge under a single selection while manipulating | keep |
| C10 | `anchor: "center"` normalised on display (`displayX/Y`) and denormalised on commit (`commitPos`) | keep |

## D. Gestures (react-moveable today)

| # | Behaviour | Status |
|---|---|---|
| D1 | Drag to move a single selection, committing position on release | keep |
| D2 | Group drag on a multi-selection, committing every position at once | keep |
| D3 | Resize on 8 handles, min 16px, committing size + position | keep |
| D4 | Live content stretch during resize, undone on release before state re-renders | keep |
| D5 | Rotate handle, committing whole degrees; 0 commits as `undefined` | keep |
| D6 | **Corner drag scales a text field's font size with the box** | **DROP — resize changes the box and only the box** |
| D7 | Snap threshold 6px against every unselected box | keep, reimplemented as smart guides |
| D8 | Canvas centre and edge guidelines (v: 0/½/max, h: 0/½/max) | keep |
| D9 | **10px grid quantisation (`GRID`)** | **DROP — deliberately removed upstream** |

## E. Creation paths

| # | Behaviour | Status |
|---|---|---|
| E1 | Draw-to-create: drag on empty canvas, live dashed preview past 4px, commits past 24×24 | keep |
| E2 | Draw start clears the selection | keep |
| E3 | Palette drop via `PALETTE_MIME` at the drop point | keep |
| E4 | Context menu on empty canvas (null id + canvas point) and on a field | keep |

## F. New in this phase

Nothing below existed before; each is additive.

| # | Behaviour |
|---|---|
| F1 | One `startDrag` primitive behind every canvas drag, with pointer capture released on **every** exit path (up, cancel, lost capture, window blur, Escape, unmount) |
| F2 | rAF-throttled movement — at most one `onMove` per frame, latest position |
| F3 | 3px screen threshold separating a click (`onTap`) from a drag (`onMove`) |
| F4 | Escape swallowed in the capture phase, so cancelling a drag cannot also trigger the builder's deselect |
| F5 | Exactly one live gesture globally; `canvasGestureActive()` makes Delete/undo/paste inert mid-drag |
| F6 | One commit per gesture ⇒ one undo entry per whole drag |
| F7 | Zoom 1×–8×, step 1.25: ctrl+wheel and pinch about the pointer, keyboard, anchor pinned across viewport resize |
| F8 | Smart guides: start/centre/end of the moving span against every other box, 6 screen-px capture, Cmd/Ctrl suppresses |
| F9 | Edge-strip resize — the whole border is grabbable at any box size; dots are wayfinding only |
| F10 | Handle thinning below 28 screen px (corners only), edge strips still grabbable |
| F11 | Rotation-aware hit testing (`hitTestRect` transforms the point into the box's local axes) |
| F12 | Alt-click digs through overlapping elements, wrapping, and drags in the same gesture |
| F13 | `MIN_SIZE` 16px clamped live from the start rect — the cursor picks the edge back up, no release jump |
| F14 | `MIN_VISIBLE` 24 canvas px of the selection must stay on canvas; bleed allowed, total loss impossible |
| F15 | Shift = proportional resize (dominant axis drives, snap applied before the ratio); Alt = from-centre; both read live per frame and combine |
| F16 | Double-click a fixed text element opens `InlineTextEditor` in place; double-click a member-editable one focuses the inspector Name field |
| F17 | Arrow-key nudge (1px, Shift 10px) with streak coalescing |
| F18 | Shift axis-lock while moving |
| F19 | Undo/redo re-selects the fields the history jump changed |

## Deliberately NOT ported

- **D6** corner-drag font scaling. Resize changes the box and only the box; fit modes still derive displayed size from the new width, identically live and after release.
- **D9** the 10px grid. Smart guides replace it.
- Layout-group frames, `onMoveSelection` for mixed selections, `onReorderChildren`, and the `layout`/`groups` props — those belong to the layout-groups phase and arrive with it.
