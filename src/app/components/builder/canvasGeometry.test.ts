import { describe, expect, it } from "vitest";
import { hitTestRect, snapAxis } from "./FieldOverlayEditor";

// The geometry the rewrite turns on. Both are pure, and both replace things
// react-moveable used to do for us — so a regression here is a regression in
// "clicking selects the thing under the cursor" and "boxes line up".

const rect = { x: 100, y: 100, width: 200, height: 100 };

describe("hitTestRect", () => {
  it("accepts points inside and rejects points outside an unrotated box", () => {
    expect(hitTestRect(rect, undefined, { x: 200, y: 150 })).toBe(true);
    expect(hitTestRect(rect, undefined, { x: 101, y: 101 })).toBe(true);
    expect(hitTestRect(rect, undefined, { x: 99, y: 150 })).toBe(false);
    expect(hitTestRect(rect, undefined, { x: 200, y: 201 })).toBe(false);
  });

  it("includes the exact edges and corners", () => {
    expect(hitTestRect(rect, undefined, { x: 100, y: 100 })).toBe(true);
    expect(hitTestRect(rect, undefined, { x: 300, y: 200 })).toBe(true);
  });

  it("follows the box when it rotates — the whole point of testing in local axes", () => {
    // A 90° rotation about the centre (200,150) turns the wide box tall.
    // A point 40px above the centre is OUTSIDE unrotated (box half-height 50
    // ... still inside), so use one clearly outside the unrotated box but
    // inside the rotated one: 90px above centre.
    const above = { x: 200, y: 60 };
    expect(hitTestRect(rect, undefined, above)).toBe(false); // 90 > 50
    expect(hitTestRect(rect, 90, above)).toBe(true); // now within the 100 half-width
  });

  it("rejects a point that a naive axis-aligned test would wrongly accept", () => {
    // The unrotated box's far corner region, once the box is turned 90°, is
    // empty space. A bounding-box test would still say yes.
    const corner = { x: 296, y: 104 };
    expect(hitTestRect(rect, undefined, corner)).toBe(true);
    expect(hitTestRect(rect, 90, corner)).toBe(false);
  });

  it("is symmetric for a 180° turn", () => {
    for (const p of [
      { x: 150, y: 120 },
      { x: 280, y: 190 },
      { x: 90, y: 90 },
    ]) {
      expect(hitTestRect(rect, 180, p)).toBe(hitTestRect(rect, undefined, p));
    }
  });
});

describe("snapAxis", () => {
  const targets = [0, 500, 1000];

  it("reports no adjustment when nothing is within the threshold", () => {
    expect(snapAxis(200, 300, targets, 6)).toEqual({ adjust: 0, guide: null });
  });

  it("snaps the leading edge and names the line it caught", () => {
    const r = snapAxis(497, 600, targets, 6);
    expect(r.adjust).toBe(3); // 497 → 500
    expect(r.guide).toBe(500);
  });

  it("snaps the trailing edge too", () => {
    const r = snapAxis(400, 503, targets, 6);
    expect(r.adjust).toBe(-3); // 503 → 500
    expect(r.guide).toBe(500);
  });

  it("snaps on the span's CENTRE, not just its edges", () => {
    // Centre of [400,604] is 502 — three px off the 500 line.
    const r = snapAxis(400, 604, targets, 6);
    expect(r.adjust).toBe(-2);
    expect(r.guide).toBe(500);
  });

  it("takes the closest candidate when several are in range", () => {
    // start is 5 away from 500, centre is 1 away — centre wins.
    const r = snapAxis(495, 507, targets, 6);
    expect(r.guide).toBe(500);
    expect(Math.abs(r.adjust)).toBeLessThanOrEqual(1);
  });

  it("respects the threshold exactly", () => {
    expect(snapAxis(494, 600, targets, 6).guide).toBe(500); // 6 away, inside
    expect(snapAxis(493, 600, targets, 6).guide).toBe(null); // 7 away, out
  });
});
