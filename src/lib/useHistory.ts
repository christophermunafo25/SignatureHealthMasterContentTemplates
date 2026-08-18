import { useCallback, useRef, useState } from "react";

/** Bounded undo/redo history owning a piece of state (the builder draft).
 *
 * Design notes, load-bearing:
 * - `set` matches the setState updater signature so call sites change by
 *   name only. The optional second argument is a coalesce key: successive
 *   sets sharing a key within COALESCE_MS collapse into ONE history entry
 *   (a keystroke stream or color scrub is one undo step, not forty).
 *   Discrete actions pass no key and always push.
 * - The stack is bounded; the oldest entry drops first.
 * - `reset` clears history and installs a new baseline — called when a
 *   template loads and after a successful save, so undo can't cross a save
 *   boundary into a stale field set.
 * - A push is skipped when the new state is structurally identical to what
 *   would be pushed (no-op updates don't burn entries).
 */

const MAX_ENTRIES = 50;
const COALESCE_MS = 400;

interface Hist<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface History<T> {
  state: T;
  /** `hold` keeps coalescing alive beyond the time window while a pointer
   * gesture (scrub, slider drag) is in progress — the whole gesture lands
   * as ONE history entry no matter how slowly the pointer moves. */
  set(updater: T | ((prev: T) => T), coalesceKey?: string, hold?: boolean): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
  reset(next: T | ((prev: T) => T)): void;
}

const apply = <T,>(updater: T | ((prev: T) => T), prev: T): T =>
  typeof updater === "function" ? (updater as (prev: T) => T)(prev) : updater;

/** Does this edit extend the entry before it, or start a new one?
 *
 * Coalescing is OPT-IN, and the three policies have to stay distinct:
 *  - no key at all  → a discrete commit (Enter in a numeric field, a segment
 *    click). Always its own entry, however fast it follows the last one.
 *  - key, no hold   → a keystroke stream. Collapses while the presses keep
 *    coming inside COALESCE_MS, then starts a fresh entry.
 *  - key with hold  → a pointer gesture. Stays open for the whole drag no
 *    matter how slowly the pointer moves; the caller ends it by releasing.
 *
 * Extracted from the hook because the failure mode is silent — a discrete
 * edit that quietly merges into the one before it makes undo skip a step —
 * and a pure predicate can be tested without a DOM. */
export function shouldCoalesce(
  last: { key: string; time: number } | null,
  coalesceKey: string | undefined,
  hold: boolean | undefined,
  now: number,
  windowMs: number = COALESCE_MS,
): boolean {
  if (coalesceKey === undefined || last === null) return false;
  if (last.key !== coalesceKey) return false;
  return hold === true || now - last.time < windowMs;
}

export function useHistory<T>(initial: T | (() => T)): History<T> {
  const [hist, setHist] = useState<Hist<T>>(() => ({
    past: [],
    present: typeof initial === "function" ? (initial as () => T)() : initial,
    future: [],
  }));
  /** Last coalesce key + timestamp; null after discrete ops, undo, reset. */
  const lastKey = useRef<{ key: string; time: number } | null>(null);

  const set = useCallback((updater: T | ((prev: T) => T), coalesceKey?: string, hold?: boolean) => {
    const now = Date.now();
    setHist((h) => {
      const next = apply(updater, h.present);
      if (next === h.present) return h;
      const coalesce = shouldCoalesce(lastKey.current, coalesceKey, hold, now);
      lastKey.current = coalesceKey ? { key: coalesceKey, time: now } : null;
      if (coalesce) {
        // Extend the in-progress entry: the pre-stream state is already on
        // the stack; only the present moves. New edits still clear redo.
        return { past: h.past, present: next, future: [] };
      }
      // Structural no-op → replace the present without burning an entry.
      if (JSON.stringify(next) === JSON.stringify(h.present)) {
        return { past: h.past, present: next, future: h.future };
      }
      const past = [...h.past, h.present].slice(-MAX_ENTRIES);
      return { past, present: next, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    lastKey.current = null;
    setHist((h) => {
      if (!h.past.length) return h;
      return {
        past: h.past.slice(0, -1),
        present: h.past[h.past.length - 1],
        future: [h.present, ...h.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    lastKey.current = null;
    setHist((h) => {
      if (!h.future.length) return h;
      return {
        past: [...h.past, h.present].slice(-MAX_ENTRIES),
        present: h.future[0],
        future: h.future.slice(1),
      };
    });
  }, []);

  const reset = useCallback((next: T | ((prev: T) => T)) => {
    lastKey.current = null;
    setHist((h) => ({ past: [], present: apply(next, h.present), future: [] }));
  }, []);

  return {
    state: hist.present,
    set,
    undo,
    redo,
    canUndo: hist.past.length > 0,
    canRedo: hist.future.length > 0,
    reset,
  };
}
