# Text sizing migration — what changes for published templates

Migrations `0030_text_sizing.sql` and `0031_text_sizing_fill.sql` replace the
`auto_fit` / `fixed_width` boolean pair with a single `text_sizing` mode, and
replace the character-count *estimate* with real glyph *measurement*.

The plan for this port flagged one risk above all others: fields that carried
`auto_fit` rendered at an estimated size, and measurement will disagree with
that estimate on some strings. Those fields would visibly change for the 69
facilities. **This document is the audit of how many are affected.**

## The audit

Run against the live portal read path — the same anonymous Edge Function the
facilities use, so it sees exactly the published set they see:

```bash
set -a && . ./.env && set +a
curl -s -X POST "$VITE_SUPABASE_URL/functions/v1/public-portal" \
  -H "Content-Type: application/json" -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -d '{"token":"~home"}'
```

(Direct `template_fields` reads return zero rows for the anon key — RLS routes
anonymous access through the Edge Function, which is correct.)

## Result, audited 2026-08-17

**8 published templates, 11 text fields, and none of them used the estimate.**

| Bucket | Count | Consequence |
|---|---:|---|
| `fixed_width` → `shrink` | **11** | Already measured. Same width fit. |
| `auto_fit` only → `shrink` | **0** | The estimate→measurement shift. **Nothing is in this bucket.** |
| neither → `free` | 0 | Byte-identical by construction. |

Every published text field was already on the measured path. The estimate was
dead code in production.

## The two remaining deltas, and why neither bites

`shrink` is not identical to the old `fixed_width`: it also constrains height,
and it has a different default floor. Both were checked against the real data.

**1. The height constraint is newly applied.** The old fixed-width fit only
checked width, so a line could satisfy it and still be taller than the box.
`shrink` requires `fontSize × lineHeight ≤ height`.

*Checked:* zero of 11 fields trip it. Every field's line box already fits its
drawn height with room to spare — the tightest is Meet the Team's Name at
36 × 1.1 = 39.6px in a 44px box.

**2. The default floor moves from 8px to 18px.** `fixedWidthFontSize` floored
at 8px; `shrink` defaults to `DEFAULT_MIN_FONT_SIZE` (18).

*Checked:* zero of 11 fields are exposed. All 11 carry an explicit
`minFontSizePx` (11–22px), so the default is never consulted.

| Template | Field | Box | Set | Min |
|---|---|---:|---:|---:|
| Meet the Team | Name | 520×44 | 36 | 16 |
| Meet the Team | Title | 460×32 | 24 | 12 |
| Stakeholder Spotlight | Name | 440×50 | 34 | 16 |
| Stakeholder Spotlight | Title | 400×34 | 21 | 12 |
| Stakeholder of the Month | Name | 373×40 | 33 | 14 |
| Happy Sigiversary (Diamond) | Name | 373×40 | 33 | 14 |
| Stakeholder Spotlight (Script) | Name | 373×40 | 33 | 14 |
| Happy Birthday (Orange) | Name | 312×55 | 46 | 20 |
| Happy Sigiversary (Circle) | Name | 373×70 | 60 | 22 |
| Happy Sigiversary (Circle) | Title | 373×28 | 22.7 | 11 |
| Happy Birthday | Name | 340×56 | 35 | 16 |

**3. Fractional authored sizes.** The engine searches whole pixels, so a field
whose set size is fractional — 22.7px on the Sigiversary Circle subtitle, from
a Figma import — would have rendered at 22px even when 22.7 fit perfectly well.

*Fixed rather than accepted.* `largestFittingSize` now tries the unrounded
ceiling before flooring, so an authored size that fits is returned exactly.
The search below the ceiling stays whole-pixel. This is a deliberate departure
from upstream, covered by three tests in `textSizing.test.ts`.

## Numeric verification

The plan asks for an export diff. This is the stronger version of it: the old
`fixedWidthFontSize` and the new `shrink` fit were run side by side, in the
browser with real Montserrat metrics, across **all 11 published text fields ×
9 sample entries** — from `Jo Ng` to a 70-character string that overflows every
box.

| | |
|---|---:|
| comparisons | 99 |
| differing before the fractional-size fix | 5 (all the 22.7px field) |
| **differing after** | **0** |

Every published field renders at the same size it did before this migration.

## The one intended behaviour change

`overflow: hidden` is gone from the text box. Previously a `fixed_width` field
clipped: an entry too long to fit even at the floor lost its tail silently.
Now it paints past the box.

This is deliberate, and it is the right trade for this product. A facility
submits a graphic and an admin reviews it; a name that visibly runs past the
ribbon gets fixed, whereas a name silently truncated mid-word ships. Nothing
about it is subtle enough to miss at review.

It only occurs past the floor — with floors of 11–22px in boxes 312–520px
wide, that means roughly 60+ characters in a name field.

## Rollback

`auto_fit` and `fixed_width` remain on the table, unread and unwritten. To roll
back, revert the app; the columns still hold the original values. A cleanup
migration should drop them once the rollback window closes — see decision 3 in
the port plan, which is still open.
