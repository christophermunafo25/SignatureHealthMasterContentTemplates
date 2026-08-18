import { describe, expect, it } from "vitest";
import { shouldCoalesce } from "./useHistory";

// The builder's three coalescing policies, pinned apart. The failure mode
// here is silent: a discrete edit that quietly merges into the one before it
// makes undo skip a step the admin expects to get back.

const WINDOW = 400;

describe("undo coalescing is opt-in", () => {
  it("keeps two discrete commits 50ms apart as separate entries", () => {
    // The case the port plan calls out by name. No key = no coalescing,
    // however fast the second commit follows.
    expect(shouldCoalesce({ key: "patch:f1:width", time: 1000 }, undefined, undefined, 1050)).toBe(
      false,
    );
  });

  it("collapses a keystroke stream sharing a key inside the window", () => {
    const last = { key: "patch:f1:label", time: 1000 };
    expect(shouldCoalesce(last, "patch:f1:label", undefined, 1050)).toBe(true);
    expect(shouldCoalesce(last, "patch:f1:label", undefined, 1000 + WINDOW - 1)).toBe(true);
  });

  it("starts a fresh entry once the stream pauses past the window", () => {
    const last = { key: "patch:f1:label", time: 1000 };
    expect(shouldCoalesce(last, "patch:f1:label", undefined, 1000 + WINDOW)).toBe(false);
    expect(shouldCoalesce(last, "patch:f1:label", undefined, 5000)).toBe(false);
  });

  it("holds a pointer gesture open however slowly the pointer moves", () => {
    // A scrub that pauses for ten seconds mid-drag is still one edit.
    const last = { key: "patch:f1:rotation", time: 1000 };
    expect(shouldCoalesce(last, "patch:f1:rotation", true, 11_000)).toBe(true);
  });

  it("never merges edits to different properties", () => {
    const last = { key: "patch:f1:width", time: 1000 };
    expect(shouldCoalesce(last, "patch:f1:height", undefined, 1010)).toBe(false);
    expect(shouldCoalesce(last, "patch:f1:height", true, 1010)).toBe(false);
  });

  it("never merges the same property across different fields", () => {
    const last = { key: "patch:f1:width", time: 1000 };
    expect(shouldCoalesce(last, "patch:f2:width", undefined, 1010)).toBe(false);
  });

  it("starts fresh after an undo or reset clears the key", () => {
    expect(shouldCoalesce(null, "patch:f1:label", undefined, 1010)).toBe(false);
    expect(shouldCoalesce(null, "patch:f1:label", true, 1010)).toBe(false);
  });
});
