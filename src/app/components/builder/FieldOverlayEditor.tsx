import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { BrandKit, FacilitySnapshot, TemplateField } from "@/lib/types";
import { useDataUrl } from "@/lib/render/useDataUrl";
import { useBrand } from "@/lib/brand/BrandContext";
import { loadGoogleFonts } from "@/lib/render/fonts";
import { fitText } from "@/lib/render/autoFit";
import { resolveFieldStyle } from "@/lib/brand/resolveStyle";
import { cornerRadiusCss, FieldBoxContent } from "../SchemaRenderer";
import { ErrorBoundary, FieldCrashFallback } from "../ErrorBoundary";
import { PALETTE_MIME, isTypingTarget, paintOrder } from "./fieldOps";
import { cancelActiveGesture, startDrag } from "./canvasGesture";

interface FieldOverlayEditorProps {
  canvasWidth: number;
  canvasHeight: number;
  backgroundUrl: string;
  /** Canvas base fill (schemaBackgroundCss) — under the background image. */
  backgroundCss?: string;
  fields: TemplateField[];
  selectedIds: string[];
  onSelect(ids: string[]): void;
  onChange(fields: TemplateField[]): void;
  /** Secondary path: the admin drew a raw box (canvas-space rect). */
  onDraw(rect: { x: number; y: number; width: number; height: number }): void;
  /** Primary path: a palette element was dropped at a canvas point. */
  onDropElement(paletteId: string, at: { x: number; y: number }): void;
  /** Image files dragged from disk (or another app) onto the canvas. */
  onDropFiles?(files: File[], at: { x: number; y: number }): void;
  /** Right-click on a field (id) or empty canvas (null, with canvas point). */
  onContextMenu(
    pos: { x: number; y: number },
    fieldId: string | null,
    canvasPoint: { x: number; y: number },
  ): void;
  /** Double-click on a member-editable element: the only text an admin owns
   * there is its NAME, which lives in the inspector — focus it. */
  onRequestLabelFocus?(fieldId: string): void;
  /** Preview-as facility for facility_logo elements (null → placeholder). */
  facility?: FacilitySnapshot | null;
}

interface DrawState {
  startX: number;
  startY: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Live geometry while a gesture is in progress. The draft (and therefore
 * history and autosave) is untouched until the gesture ends: overrides hold
 * the per-frame truth, one state write per frame, and the commit on release
 * writes exactly what was last rendered — mid-drag IS what you get. */
interface GestureFrame {
  kind: "move" | "resize" | "rotate";
  overrides: Map<string, Partial<TemplateField>>;
  guides: Guide[];
}

interface Guide {
  axis: "v" | "h";
  /** Canvas-space position of the line. */
  pos: number;
}

/** Smallest committable box edge, canvas px. Applied live during the drag
 * (computed from the start rect, so the cursor picks the edge back up on the
 * way out — no jump at release). */
const MIN_SIZE = 16;
/** Snap capture distance in screen px (converted per-frame to canvas px). */
const SNAP_SCREEN_PX = 6;
/** Movement below this many screen px is a click, not a drag. */
const DRAG_THRESHOLD_PX = 3;
/** A move can bleed past the canvas edge, but this much of the selection
 * must stay inside — an element can never be dragged fully out of reach.
 * Clamped live during the drag, so what shows is what commits. */
const MIN_VISIBLE = 24;
/** Below this box size on screen (px), the mid-edge handles crowd the
 * corners and the body — only the corner handles render. The edge STRIPS
 * stay grabbable regardless; the dots are wayfinding, not the hit target. */
const HANDLE_CROWD_PX = 28;

/** Zoom multiplies the fit scale, so 1 is always "the whole canvas". Zooming
 * out past fit would only add empty space, hence the floor at 1. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.25;

/** Invisible resize strips along each border: the whole edge is grabbable,
 * Figma-style, whatever size the box is. Inset from the ends so the corner
 * dots win the corners. */
const EDGE_STRIPS: Array<{
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
  cursor: string;
  style: React.CSSProperties;
}> = [
  { dx: 0, dy: -1, cursor: "ns-resize", style: { left: 8, right: 8, top: -5, height: 10 } },
  { dx: 0, dy: 1, cursor: "ns-resize", style: { left: 8, right: 8, bottom: -5, height: 10 } },
  { dx: -1, dy: 0, cursor: "ew-resize", style: { top: 8, bottom: 8, left: -5, width: 10 } },
  { dx: 1, dy: 0, cursor: "ew-resize", style: { top: 8, bottom: 8, right: -5, width: 10 } },
];

const RESIZE_DIRS: Array<{ dx: -1 | 0 | 1; dy: -1 | 0 | 1; cursor: string }> = [
  { dx: -1, dy: -1, cursor: "nwse-resize" },
  { dx: 0, dy: -1, cursor: "ns-resize" },
  { dx: 1, dy: -1, cursor: "nesw-resize" },
  { dx: 1, dy: 0, cursor: "ew-resize" },
  { dx: 1, dy: 1, cursor: "nwse-resize" },
  { dx: 0, dy: 1, cursor: "ns-resize" },
  { dx: -1, dy: 1, cursor: "nesw-resize" },
  { dx: -1, dy: 0, cursor: "ew-resize" },
];

/** Editor always works in top-left space; center-anchored fields are
 * normalized on display and denormalized on commit. */
const displayX = (f: TemplateField): number => (f.anchor === "center" ? f.x - f.width / 2 : f.x);
const displayY = (f: TemplateField): number => (f.anchor === "center" ? f.y - f.height / 2 : f.y);
const toAnchorSpace = (
  f: TemplateField,
  tlx: number,
  tly: number,
  w = f.width,
  h = f.height,
): { x: number; y: number } => ({
  x: f.anchor === "center" ? tlx + w / 2 : tlx,
  y: f.anchor === "center" ? tly + h / 2 : tly,
});

/** Whether a canvas-space point falls inside a display rect, rotation
 * included: transform the point into the box's local axes and compare. */
export function hitTestRect(
  r: { x: number; y: number; width: number; height: number },
  rotation: number | undefined,
  p: { x: number; y: number },
): boolean {
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const rad = ((rotation ?? 0) * Math.PI) / 180;
  const dx0 = p.x - cx;
  const dy0 = p.y - cy;
  const dx = Math.cos(rad) * dx0 + Math.sin(rad) * dy0;
  const dy = -Math.sin(rad) * dx0 + Math.cos(rad) * dy0;
  return Math.abs(dx) <= r.width / 2 && Math.abs(dy) <= r.height / 2;
}

/** Snap one axis of a moving span: try its start / center / end against the
 * targets, take the closest hit inside the threshold, and report the line. */
export function snapAxis(
  lo: number,
  hi: number,
  targets: number[],
  thresh: number,
): { adjust: number; guide: number | null } {
  const cands = [lo, (lo + hi) / 2, hi];
  let best = Infinity;
  let adjust = 0;
  let guide: number | null = null;
  for (const t of targets) {
    for (const c of cands) {
      const d = t - c;
      if (Math.abs(d) < Math.abs(best)) {
        best = d;
        adjust = d;
        guide = t;
      }
    }
  }
  if (Math.abs(best) > thresh) return { adjust: 0, guide: null };
  return { adjust, guide };
}

/** Memoized so only fields whose geometry is actually changing re-render
 * their content per frame (text measurement isn't free). */
const FieldContent = React.memo(FieldBoxContent);

/** In-place editing for a FIXED text element's content (double-click to
 * enter). A contentEditable mirror of the renderer's own <p> — same resolved
 * face, size fitting, alignment, spacing — so entering and leaving edit mode
 * moves nothing. Commits ONCE on exit (blur or Enter): one undo entry per
 * editing session. Escape reverts and exits. */
function InlineTextEditor({
  field,
  brandKit,
  scale,
  onCommit,
  onExit,
}: {
  field: TemplateField;
  brandKit: BrandKit | null;
  scale: number;
  onCommit(text: string): void;
  onExit(): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const original = field.staticValue ?? "";
  /** Mirrors the DOM text purely so font fitting recomputes per keystroke —
   * the contentEditable itself stays uncontrolled. */
  const [text, setText] = useState(original);
  const cancelled = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);

  const style = resolveFieldStyle(field, brandKit);
  const singleLine = field.type !== "multiline";
  const shown = text || " ";
  const fontSize = fitText(
    { ...style, multiline: !singleLine, width: field.width, height: field.height },
    shown,
  ).fontSizePx;
  const brandHex = style.colorKey
    ? brandKit?.colors.find((c) => c.key === style.colorKey)?.hex
    : undefined;
  const color = brandHex ?? style.colorHex ?? "#111111";
  const justify =
    field.align === "center" ? "center" : field.align === "right" ? "flex-end" : "flex-start";
  const alignItems =
    field.verticalAlign === "top"
      ? "flex-start"
      : field.verticalAlign === "bottom"
        ? "flex-end"
        : "center";

  const finish = (commit: boolean) => {
    if (cancelled.current) return;
    cancelled.current = true;
    if (commit) {
      const next = ref.current?.innerText ?? text;
      if (next !== original) onCommit(next);
    }
    onExit();
  };

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div
        style={{
          width: field.width,
          height: field.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          display: "flex",
          alignItems,
          justifyContent: justify,
        }}
      >
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label={`Edit ${field.label} content`}
          onInput={(e) => setText((e.target as HTMLElement).innerText)}
          onBlur={() => finish(true)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") {
              e.preventDefault();
              cancelled.current = true;
              onExit();
            } else if (e.key === "Enter" && singleLine) {
              e.preventDefault();
              finish(true);
            }
          }}
          style={{
            outline: "none",
            width: singleLine ? undefined : "100%",
            fontFamily: style.fontFamily ? `"${style.fontFamily}", sans-serif` : "sans-serif",
            fontWeight: style.fontWeight,
            fontSize,
            color,
            textAlign: field.align ?? "left",
            textTransform: style.uppercase ? "uppercase" : undefined,
            letterSpacing: style.letterSpacingPx ? `${style.letterSpacingPx}px` : undefined,
            lineHeight: style.lineHeight ?? 1.1,
            whiteSpace: singleLine ? "nowrap" : "pre-wrap",
            wordBreak: singleLine ? undefined : "break-word",
            margin: 0,
            cursor: "text",
          }}
        >
          {original}
        </div>
      </div>
    </div>
  );
}

/** The Template Builder's design canvas. Every drag — move, resize, rotate,
 * draw-to-create — runs through the one `startDrag` primitive, so all of them
 * share pointer capture, rAF throttling, a click/drag threshold, and clean
 * cancellation. One commit per gesture means one undo entry per drag.
 *
 * Live geometry lives in a gesture frame rather than the draft: mid-drag is
 * exactly what commits on release, and history sees a single entry. */
export function FieldOverlayEditor(props: FieldOverlayEditorProps) {
  const {
    canvasWidth,
    canvasHeight,
    backgroundUrl,
    backgroundCss,
    fields,
    selectedIds,
    onSelect,
    onChange,
    onDraw,
    onDropElement,
    onDropFiles,
    onContextMenu,
    onRequestLabelFocus,
    facility,
  } = props;
  const { kit } = useBrand();
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.4);
  const [zoom, setZoom] = useState(1);
  const scale = fitScale * zoom;
  const [draw, setDraw] = useState<DrawState | null>(null);
  const [frame, setFrame] = useState<GestureFrame | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const backgroundDataUrl = useDataUrl(backgroundUrl || undefined);

  // Mirrors: gesture callbacks are created once per gesture and must always
  // read the CURRENT draft, not the one captured when the drag began.
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const selectedRef = useRef(selectedIds);
  selectedRef.current = selectedIds;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  /** Owned by applyZoom, which advances it eagerly — wheel ticks and clicks
   * arrive faster than React re-renders and each must step off the last. */
  const zoomRef = useRef(zoom);
  const zoomAnchorRef = useRef<{ canvasX: number; canvasY: number; vx: number; vy: number } | null>(
    null,
  );

  // A mode switch or unmount mid-drag must not strand a pointer capture.
  useEffect(() => () => cancelActiveGesture(), []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () =>
      setFitScale(Math.min(el.clientWidth / canvasWidth, el.clientHeight / canvasHeight, 1));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [canvasWidth, canvasHeight]);

  // The edit canvas shows real field content in the real styling, so the
  // designed typefaces must load here too, not just in preview mode.
  useEffect(() => {
    loadGoogleFonts(
      fields
        .map((f) => resolveFieldStyle(f, kit).fontFamily)
        .filter((f): f is string => Boolean(f)),
    );
  }, [fields, kit]);

  /** Zoom to `next`, holding a point still: whatever sits under the cursor
   * (or the middle of the view, for the buttons and shortcuts) stays put. */
  const applyZoom = useCallback((next: number, anchor?: { clientX: number; clientY: number }) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    if (clamped === zoomRef.current) return;
    const vp = viewportRef.current;
    const surface = containerRef.current;
    zoomRef.current = clamped;
    setZoom(clamped);
    if (!vp || !surface) return;
    // Only the FIRST pin of a batch is measured against un-stale geometry,
    // and it stays valid: "hold canvas point P at viewport position A" is
    // true whatever the intermediate steps were.
    if (zoomAnchorRef.current) return;
    const vpRect = vp.getBoundingClientRect();
    const surfRect = surface.getBoundingClientRect();
    const before = scaleRef.current;
    const ax = (anchor?.clientX ?? vpRect.left + vp.clientWidth / 2) - vpRect.left;
    const ay = (anchor?.clientY ?? vpRect.top + vp.clientHeight / 2) - vpRect.top;
    zoomAnchorRef.current = {
      canvasX: (vpRect.left + ax - surfRect.left) / before,
      canvasY: (vpRect.top + ay - surfRect.top) / before,
      vx: ax,
      vy: ay,
    };
  }, []);

  // Re-pin after the zoomed surface has laid out, so the anchor point sits
  // exactly where it did before the zoom.
  useLayoutEffect(() => {
    const pin = zoomAnchorRef.current;
    const vp = viewportRef.current;
    if (!pin || !vp) return;
    zoomAnchorRef.current = null;
    vp.scrollLeft += pin.canvasX * scale - pin.vx - vp.scrollLeft;
    vp.scrollTop += pin.canvasY * scale - pin.vy - vp.scrollTop;
  }, [scale]);

  // Ctrl/Cmd + wheel zooms about the pointer; the browser's own page zoom
  // gesture is the one thing that must not fire here.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const factor = Math.pow(ZOOM_STEP, -e.deltaY / 100);
      applyZoom(zoomRef.current * factor, e);
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [applyZoom]);

  // Keyboard zoom, matching every design tool: Cmd+= in, Cmd+- out, Cmd+0 fit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (isTypingTarget(e)) return;
      if (e.key === "0") {
        e.preventDefault();
        applyZoom(1);
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        applyZoom(zoomRef.current * ZOOM_STEP);
      } else if (e.key === "-") {
        e.preventDefault();
        applyZoom(zoomRef.current / ZOOM_STEP);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applyZoom]);

  /** Screen → canvas px, clamped into the canvas. */
  const toCanvas = useCallback((e: { clientX: number; clientY: number }) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const s = scaleRef.current;
    return {
      x: Math.max(0, Math.min(canvasWidth, (e.clientX - rect.left) / s)),
      y: Math.max(0, Math.min(canvasHeight, (e.clientY - rect.top) / s)),
    };
  }, [canvasWidth, canvasHeight]);

  /** Unclamped — rotation needs true angles past the canvas edge. */
  const toCanvasFree = useCallback((e: { clientX: number; clientY: number }) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const s = scaleRef.current;
    return { x: (e.clientX - rect.left) / s, y: (e.clientY - rect.top) / s };
  }, []);

  const displayRect = (f: TemplateField) => ({
    x: displayX(f),
    y: displayY(f),
    width: f.width,
    height: f.height,
  });

  const snapTargets = (excluded: Set<string>) => {
    const v = [0, canvasWidth / 2, canvasWidth];
    const h = [0, canvasHeight / 2, canvasHeight];
    for (const f of fieldsRef.current) {
      if (excluded.has(f.id)) continue;
      const r = displayRect(f);
      v.push(r.x, r.x + r.width / 2, r.x + r.width);
      h.push(r.y, r.y + r.height / 2, r.y + r.height);
    }
    return { v, h };
  };

  /** One commit per gesture = one undo entry. Geometry rounds to whole
   * canvas px here and only here — frames stay fractional so slow drags
   * don't stair-step. */
  const commitOverrides = (overrides: Map<string, Partial<TemplateField>>) => {
    const next = fieldsRef.current.map((f) => {
      const o = overrides.get(f.id);
      if (!o) return f;
      const merged: TemplateField = { ...f, ...o };
      if (o.x !== undefined) merged.x = Math.round(merged.x);
      if (o.y !== undefined) merged.y = Math.round(merged.y);
      if (o.width !== undefined) merged.width = Math.max(MIN_SIZE, Math.round(merged.width));
      if (o.height !== undefined) merged.height = Math.max(MIN_SIZE, Math.round(merged.height));
      if (o.rotation !== undefined) {
        const deg = Math.round(o.rotation) % 360;
        merged.rotation = deg === 0 ? undefined : deg;
      }
      return merged;
    });
    onChangeRef.current(next);
  };

  // --- Move -----------------------------------------------------------------

  const beginMove = (e: React.PointerEvent, ids: string[]) => {
    const dragSet = new Set(ids);
    const startRects = fieldsRef.current
      .filter((f) => dragSet.has(f.id))
      .map((f) => ({ f, tlx: displayX(f), tly: displayY(f) }));
    if (!startRects.length) return;

    // The bounding box spans everything travelling, so snapping and the
    // stay-on-canvas clamp treat a multi-selection as one object.
    const bbox = {
      l: Math.min(...startRects.map((r) => r.tlx)),
      t: Math.min(...startRects.map((r) => r.tly)),
      r: Math.max(...startRects.map((r) => r.tlx + r.f.width)),
      b: Math.max(...startRects.map((r) => r.tly + r.f.height)),
    };
    const targets = snapTargets(dragSet);
    let latest: Map<string, Partial<TemplateField>> | null = null;

    startDrag(e.nativeEvent, containerRef.current!, {
      threshold: DRAG_THRESHOLD_PX,
      onMove: (dx, dy, ev) => {
        const s = scaleRef.current;
        let ddx = dx / s;
        let ddy = dy / s;
        // Shift locks to the dominant axis — re-read from the raw deltas
        // every frame, so the lock follows the pointer's larger travel and
        // releasing shift mid-drag frees both axes again.
        const lockX = ev.shiftKey && Math.abs(dx) < Math.abs(dy);
        const lockY = ev.shiftKey && !lockX;
        if (lockX) ddx = 0;
        if (lockY) ddy = 0;
        const guides: Guide[] = [];
        if (!ev.metaKey && !ev.ctrlKey) {
          const thresh = SNAP_SCREEN_PX / s;
          if (!lockX) {
            const sx = snapAxis(bbox.l + ddx, bbox.r + ddx, targets.v, thresh);
            ddx += sx.adjust;
            if (sx.guide !== null) guides.push({ axis: "v", pos: sx.guide });
          }
          if (!lockY) {
            const sy = snapAxis(bbox.t + ddy, bbox.b + ddy, targets.h, thresh);
            ddy += sy.adjust;
            if (sy.guide !== null) guides.push({ axis: "h", pos: sy.guide });
          }
        }
        // Never lose an element off the canvas: enough of the selection must
        // stay inside to grab it again. Clamped live, so there is no
        // snap-back at release.
        ddx = Math.min(ddx, canvasWidth - MIN_VISIBLE - bbox.l);
        ddx = Math.max(ddx, MIN_VISIBLE - bbox.r);
        ddy = Math.min(ddy, canvasHeight - MIN_VISIBLE - bbox.t);
        ddy = Math.max(ddy, MIN_VISIBLE - bbox.b);
        const overrides = new Map<string, Partial<TemplateField>>();
        for (const r of startRects) {
          overrides.set(r.f.id, toAnchorSpace(r.f, r.tlx + ddx, r.tly + ddy));
        }
        latest = overrides;
        setFrame({ kind: "move", overrides, guides });
      },
      onEnd: () => {
        setFrame(null);
        if (latest) commitOverrides(latest);
      },
      onCancel: () => setFrame(null),
    });
  };

  // --- Resize ---------------------------------------------------------------

  const beginResize = (
    e: React.PointerEvent,
    f: TemplateField,
    dirX: -1 | 0 | 1,
    dirY: -1 | 0 | 1,
  ) => {
    const tlx0 = displayX(f);
    const tly0 = displayY(f);
    const w0 = f.width;
    const h0 = f.height;
    const rad = ((f.rotation ?? 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const unrotated = !f.rotation;
    const targets = snapTargets(new Set([f.id]));
    const c0x = tlx0 + w0 / 2;
    const c0y = tly0 + h0 / 2;
    let latest: Map<string, Partial<TemplateField>> | null = null;

    startDrag(e.nativeEvent, containerRef.current!, {
      threshold: DRAG_THRESHOLD_PX,
      onMove: (dx, dy, ev) => {
        const s = scaleRef.current;
        // The pointer delta expressed along the element's own axes, so a
        // rotated box resizes along its edges, not the screen's.
        const cdx = dx / s;
        const cdy = dy / s;
        const ldx = cos * cdx + sin * cdy;
        const ldy = -sin * cdx + cos * cdy;
        // Modifiers read live from the event, so pressing or releasing them
        // mid-drag takes effect on the very next frame.
        const fromCenter = ev.altKey;
        const proportional = ev.shiftKey;
        // From-center: the pointer moves one edge, the mirror edge follows.
        const k = fromCenter ? 2 : 1;
        let w1 = dirX !== 0 ? w0 + dirX * ldx * k : w0;
        let h1 = dirY !== 0 ? h0 + dirY * ldy * k : h0;
        const guides: Guide[] = [];

        /** Where the handle-side vertical/horizontal edge currently sits. */
        const movingEdgeX = () =>
          fromCenter ? c0x + (dirX * w1) / 2 : dirX === 1 ? tlx0 + w1 : tlx0 + w0 - w1;
        const movingEdgeY = () =>
          fromCenter ? c0y + (dirY * h1) / 2 : dirY === 1 ? tly0 + h1 : tly0 + h0 - h1;
        /** Grow/shrink one axis so its moving edge lands on the snapped
         * position (a from-center edge moves at half the rate of the size). */
        const applyX = (adjust: number) => (w1 += dirX * adjust * k);
        const applyY = (adjust: number) => (h1 += dirY * adjust * k);

        const snappable = unrotated && !ev.metaKey && !ev.ctrlKey;
        const thresh = SNAP_SCREEN_PX / s;

        if (proportional) {
          // One scale factor for both axes, driven by whichever axis the
          // pointer has changed more; the other follows. Snap the driving
          // edge first so the ratio is computed from the snapped size.
          const sxr = dirX !== 0 ? w1 / w0 : null;
          const syr = dirY !== 0 ? h1 / h0 : null;
          const driveX = sxr !== null && (syr === null || Math.abs(sxr - 1) >= Math.abs(syr - 1));
          if (snappable) {
            if (driveX) {
              const hit = snapAxis(movingEdgeX(), movingEdgeX(), targets.v, thresh);
              if (hit.guide !== null) {
                applyX(hit.adjust);
                guides.push({ axis: "v", pos: hit.guide });
              }
            } else {
              const hit = snapAxis(movingEdgeY(), movingEdgeY(), targets.h, thresh);
              if (hit.guide !== null) {
                applyY(hit.adjust);
                guides.push({ axis: "h", pos: hit.guide });
              }
            }
          }
          let sc = driveX ? w1 / w0 : h1 / h0;
          sc = Math.max(sc, MIN_SIZE / w0, MIN_SIZE / h0);
          w1 = w0 * sc;
          h1 = h0 * sc;
        } else {
          if (snappable && dirX !== 0) {
            const hit = snapAxis(movingEdgeX(), movingEdgeX(), targets.v, thresh);
            if (hit.guide !== null) {
              applyX(hit.adjust);
              guides.push({ axis: "v", pos: hit.guide });
            }
          }
          if (snappable && dirY !== 0) {
            const hit = snapAxis(movingEdgeY(), movingEdgeY(), targets.h, thresh);
            if (hit.guide !== null) {
              applyY(hit.adjust);
              guides.push({ axis: "h", pos: hit.guide });
            }
          }
          // The box stops at the minimum while the cursor keeps going, and —
          // because every frame recomputes from the start rect — picks back
          // up the moment the cursor returns. No jump at release.
          w1 = Math.max(MIN_SIZE, w1);
          h1 = Math.max(MIN_SIZE, h1);
        }

        // The fixed point is the center (alt) or the corner/edge opposite
        // the handle, held in world space; the new center falls out of it.
        // Computed fresh from the start rect every frame — nothing
        // accumulates, so nothing drifts.
        let c1x = c0x;
        let c1y = c0y;
        if (!fromCenter) {
          const ax = (-dirX * w0) / 2;
          const ay = (-dirY * h0) / 2;
          const awx = c0x + cos * ax - sin * ay;
          const awy = c0y + sin * ax + cos * ay;
          const nx = (dirX * w1) / 2;
          const ny = (dirY * h1) / 2;
          c1x = awx + cos * nx - sin * ny;
          c1y = awy + sin * nx + cos * ny;
        }
        const tlx1 = c1x - w1 / 2;
        const tly1 = c1y - h1 / 2;
        const overrides = new Map<string, Partial<TemplateField>>([
          [f.id, { ...toAnchorSpace(f, tlx1, tly1, w1, h1), width: w1, height: h1 }],
        ]);
        latest = overrides;
        setFrame({ kind: "resize", overrides, guides });
      },
      onEnd: () => {
        setFrame(null);
        // A resize changes the BOX and only the box: font size is a property
        // the admin sets, never a side effect of a drag. Fitting modes keep
        // deriving their displayed size from the new width exactly as they
        // will render after release.
        if (latest) commitOverrides(latest);
      },
      onCancel: () => setFrame(null),
    });
  };

  // --- Rotate ---------------------------------------------------------------

  const beginRotate = (e: React.PointerEvent, f: TemplateField) => {
    const cx = displayX(f) + f.width / 2;
    const cy = displayY(f) + f.height / 2;
    const p0 = toCanvasFree(e);
    const a0 = Math.atan2(p0.y - cy, p0.x - cx);
    const r0 = f.rotation ?? 0;
    let latest: Map<string, Partial<TemplateField>> | null = null;

    startDrag(e.nativeEvent, containerRef.current!, {
      threshold: DRAG_THRESHOLD_PX,
      onMove: (_dx, _dy, ev) => {
        const p = toCanvasFree(ev);
        const a = Math.atan2(p.y - cy, p.x - cx);
        let deg = r0 + ((a - a0) * 180) / Math.PI;
        if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
        const overrides = new Map<string, Partial<TemplateField>>([[f.id, { rotation: deg }]]);
        latest = overrides;
        setFrame({ kind: "rotate", overrides, guides: [] });
      },
      onEnd: () => {
        setFrame(null);
        if (latest) commitOverrides(latest);
      },
      onCancel: () => setFrame(null),
    });
  };

  // --- Draw-to-create (empty canvas) ---------------------------------------

  const beginDraw = (e: React.PointerEvent) => {
    onSelectRef.current([]);
    const p0 = toCanvas(e);
    let last: DrawState | null = null;

    startDrag(e.nativeEvent, containerRef.current!, {
      threshold: DRAG_THRESHOLD_PX,
      onMove: (_dx, _dy, ev) => {
        const p = toCanvas(ev);
        last = {
          startX: p0.x,
          startY: p0.y,
          x: Math.min(p0.x, p.x),
          y: Math.min(p0.y, p.y),
          w: Math.abs(p.x - p0.x),
          h: Math.abs(p.y - p0.y),
        };
        setDraw(last);
      },
      onEnd: () => {
        setDraw(null);
        if (last && last.w > 24 && last.h > 24) {
          onDraw({
            x: Math.round(last.x),
            y: Math.round(last.y),
            width: Math.round(last.w),
            height: Math.round(last.h),
          });
        }
      },
      onCancel: () => setDraw(null),
    });
  };

  // --- Hit testing ----------------------------------------------------------

  /** Every field under a canvas point, topmost first. */
  const hitsAt = (p: { x: number; y: number }): TemplateField[] =>
    paintOrder(fieldsRef.current)
      .filter((f) => hitTestRect(displayRect(f), f.rotation, p))
      .reverse();

  /** Pointer-down anywhere on the canvas surface. One entry point, so
   * selection, alt-dig, move and draw all start from the same hit test
   * rather than from whichever DOM node happened to be on top. */
  const onSurfacePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (editingId) return; // the inline editor owns its own pointer handling
    const p = toCanvas(e);
    const stack = hitsAt(p);
    if (!stack.length) {
      beginDraw(e);
      return;
    }
    // Alt digs one layer further down each time, wrapping at the bottom, so
    // an element buried under others is reachable without moving anything.
    let target = stack[0];
    if (e.altKey && stack.length > 1) {
      const current = stack.findIndex((f) => selectedRef.current.includes(f.id));
      target = stack[(current + 1) % stack.length];
    }
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    let nextSelection: string[];
    if (additive) {
      nextSelection = selectedRef.current.includes(target.id)
        ? selectedRef.current.filter((id) => id !== target.id)
        : [...selectedRef.current, target.id];
      onSelectRef.current(nextSelection);
      return; // a modifier click adjusts the selection; it never starts a drag
    }
    nextSelection = selectedRef.current.includes(target.id)
      ? selectedRef.current
      : [target.id];
    if (nextSelection !== selectedRef.current) onSelectRef.current(nextSelection);
    // Select AND move in one gesture: the threshold decides which it was.
    beginMove(e, nextSelection);
  };

  const onSurfaceDoubleClick = (e: React.MouseEvent) => {
    const stack = hitsAt(toCanvas(e));
    const f = stack[0];
    if (!f) return;
    const isText = f.type === "text" || f.type === "multiline";
    if (!isText) return;
    if (f.static) {
      setEditingId(f.id);
    } else {
      // The only text an admin owns on a member-editable element is its
      // NAME, and that lives in the inspector.
      onRequestLabelFocus?.(f.id);
    }
  };

  // --- Render ---------------------------------------------------------------

  /** The field as currently shown: draft state plus any live gesture frame. */
  const viewOf = (f: TemplateField): TemplateField => {
    const o = frame?.overrides.get(f.id);
    return o ? ({ ...f, ...o } as TemplateField) : f;
  };

  const selected = fields.filter((f) => selectedIds.includes(f.id));
  const single = selected.length === 1 ? viewOf(selected[0]) : null;
  const editing = editingId ? fields.find((f) => f.id === editingId) : undefined;

  const dims =
    frame && single
      ? { w: Math.round(single.width), h: Math.round(single.height) }
      : null;

  return (
    <div
      ref={viewportRef}
      className="relative w-full overflow-auto"
      style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}`, touchAction: "none" }}
    >
      <div
        ref={containerRef}
        data-overlay-root
        className="relative select-none"
        style={{
          width: canvasWidth * scale,
          height: canvasHeight * scale,
          cursor: "crosshair",
        }}
        onDragOver={(e) => {
          if (
            e.dataTransfer.types.includes(PALETTE_MIME) ||
            e.dataTransfer.types.includes("Files")
          ) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={(e) => {
          const paletteId = e.dataTransfer.getData(PALETTE_MIME);
          if (paletteId) {
            e.preventDefault();
            onDropElement(paletteId, toCanvas(e));
            return;
          }
          const files = Array.from(e.dataTransfer.files ?? []);
          if (files.length && onDropFiles) {
            e.preventDefault();
            onDropFiles(files, toCanvas(e));
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          const p = toCanvas(e);
          const hit = hitsAt(p)[0];
          if (hit && !selectedIds.includes(hit.id)) onSelect([hit.id]);
          onContextMenu({ x: e.clientX, y: e.clientY }, hit?.id ?? null, p);
        }}
        onPointerDown={onSurfacePointerDown}
        onPointerMove={(e) => {
          // Only when idle: mid-gesture the pointer is captured and the
          // hovered element is not the interesting one.
          if (frame || draw) return;
          const top = hitsAt(toCanvas(e))[0];
          setHoveredId((id) => (top?.id ?? null) === id ? id : (top?.id ?? null));
        }}
        onPointerLeave={() => setHoveredId(null)}
        onDoubleClick={onSurfaceDoubleClick}
      >
        {/* Background at canvas scale */}
        <div
          style={{
            width: canvasWidth,
            height: canvasHeight,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            position: "absolute",
            top: 0,
            left: 0,
            background: backgroundCss ?? "#fff",
            pointerEvents: "none",
          }}
        >
          {backgroundDataUrl && (
            <img
              src={backgroundDataUrl}
              alt=""
              data-role="bg"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          )}
        </div>

        {/* Field boxes (screen space = canvas × scale; z = canvas layer order) */}
        {fields.map((raw) => {
          const f = viewOf(raw);
          const isSelected = selectedIds.includes(f.id);
          const isEditing = editingId === f.id;
          return (
            <div
              key={f.id}
              style={{
                position: "absolute",
                left: displayX(f) * scale,
                top: displayY(f) * scale,
                width: f.width * scale,
                height: f.height * scale,
                zIndex: (f.zIndex ?? 0) + 1, // +1 keeps every box above the background
                transform: f.rotation ? `rotate(${f.rotation}deg)` : undefined,
                border: isSelected
                  ? "var(--editor-line) solid var(--editor-accent)"
                  : "var(--editor-line) dashed color-mix(in srgb, var(--editor-accent) 65%, transparent)",
                borderRadius: f.type === "image" ? cornerRadiusCss(f) : undefined,
                background: "transparent",
                // Hit testing is done on the surface against real geometry,
                // so the boxes themselves stay out of the pointer's way.
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                  pointerEvents: "none",
                }}
              >
                {isEditing && editing ? null : (
                  <div
                    data-field-content
                    style={{
                      width: f.width,
                      height: f.height,
                      transform: `scale(${scale})`,
                      transformOrigin: "top left",
                      pointerEvents: "none",
                    }}
                  >
                    <ErrorBoundary
                      level="field"
                      context={{ fieldId: f.id }}
                      resetKeys={[f.id, f.type]}
                      fallback={() => (
                        <FieldCrashFallback width={f.width} height={f.height} />
                      )}
                    >
                      <FieldContent
                        field={f}
                        value={undefined}
                        brandKit={kit}
                        facility={facility}
                      />
                    </ErrorBoundary>
                  </div>
                )}
              </div>

              {isEditing && editing && (
                <div style={{ pointerEvents: "auto" }}>
                  <InlineTextEditor
                    field={f}
                    brandKit={kit}
                    scale={scale}
                    onCommit={(text) =>
                      onChangeRef.current(
                        fieldsRef.current.map((x) =>
                          x.id === f.id ? { ...x, staticValue: text } : x,
                        ),
                      )
                    }
                    onExit={() => setEditingId(null)}
                  />
                </div>
              )}

              {(isSelected || hoveredId === f.id) && !isEditing && (
                <span
                  className="absolute -top-4 left-0 rounded whitespace-nowrap"
                  style={{
                    background: "var(--editor-accent)",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 500,
                    padding: "1px 4px",
                    pointerEvents: "none",
                  }}
                >
                  {f.label}
                  {(() => {
                    // "Image · image" says nothing — suppress the type when
                    // it duplicates the label. "fixed" always informs.
                    const segment = f.static
                      ? "fixed"
                      : f.label.trim().toLowerCase() === f.type
                        ? null
                        : f.type;
                    return segment ? ` · ${segment}` : "";
                  })()}
                </span>
              )}
            </div>
          );
        })}

        {/* Selection handles — one selection only, and never mid-edit. */}
        {single && !editingId && (
          <SelectionHandles
            field={single}
            scale={scale}
            onResize={beginResize}
            onRotate={beginRotate}
          />
        )}

        {/* Smart guides */}
        {frame?.guides.map((g, i) => (
          <div
            key={`${g.axis}-${g.pos}-${i}`}
            style={{
              position: "absolute",
              background: "var(--editor-accent)",
              pointerEvents: "none",
              zIndex: 9998,
              ...(g.axis === "v"
                ? { left: g.pos * scale, top: 0, width: 1, height: canvasHeight * scale }
                : { top: g.pos * scale, left: 0, height: 1, width: canvasWidth * scale }),
            }}
          />
        ))}

        {/* Dimension badge under the selection while manipulating */}
        {dims && single && (
          <span
            className="absolute whitespace-nowrap rounded"
            style={{
              left: (displayX(single) + single.width / 2) * scale,
              top: (displayY(single) + single.height) * scale + 6,
              transform: "translateX(-50%)",
              background: "var(--editor-accent)",
              color: "#fff",
              fontSize: 9,
              fontWeight: 500,
              padding: "1px 4px",
              pointerEvents: "none",
              zIndex: 9999,
            }}
          >
            {dims.w} × {dims.h}
          </span>
        )}

        {/* Draw preview */}
        {draw && draw.w > 4 && (
          <div
            style={{
              position: "absolute",
              left: draw.x * scale,
              top: draw.y * scale,
              width: draw.w * scale,
              height: draw.h * scale,
              border: "var(--editor-line) dashed var(--editor-accent)",
              background: "color-mix(in srgb, var(--editor-accent) 8%, transparent)",
              pointerEvents: "none",
              zIndex: 10000,
            }}
          />
        )}
      </div>

      {/* Zoom controls — sticky to the viewport, not the canvas surface. */}
      <div
        className="sticky flex items-center gap-1 rounded"
        style={{
          bottom: 8,
          left: 8,
          width: "fit-content",
          padding: "2px 4px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-control)",
          zIndex: 10001,
        }}
      >
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out (⌘−)"
          onClick={() => applyZoom(zoomRef.current / ZOOM_STEP)}
          disabled={zoom <= MIN_ZOOM}
          style={{ display: "flex", padding: 4, color: "var(--text-secondary)" }}
        >
          <Minus style={{ width: 12, height: 12 }} />
        </button>
        <button
          type="button"
          onClick={() => applyZoom(1)}
          title="Fit the canvas (⌘0)"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            minWidth: 34,
            color: "var(--text-secondary)",
          }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in (⌘+)"
          onClick={() => applyZoom(zoomRef.current * ZOOM_STEP)}
          disabled={zoom >= MAX_ZOOM}
          style={{ display: "flex", padding: 4, color: "var(--text-secondary)" }}
        >
          <Plus style={{ width: 12, height: 12 }} />
        </button>
      </div>
    </div>
  );
}

/** Resize and rotate affordances for the single selection. The edge STRIPS
 * are the real hit targets — the whole border is grabbable at any box size —
 * and the dots are wayfinding, thinning to corners-only when the box gets
 * small enough that mid-edge dots would crowd the corners. */
function SelectionHandles({
  field,
  scale,
  onResize,
  onRotate,
}: {
  field: TemplateField;
  scale: number;
  onResize(e: React.PointerEvent, f: TemplateField, dx: -1 | 0 | 1, dy: -1 | 0 | 1): void;
  onRotate(e: React.PointerEvent, f: TemplateField): void;
}) {
  const w = field.width * scale;
  const h = field.height * scale;
  const crowded = Math.min(w, h) < HANDLE_CROWD_PX;
  const dots = crowded ? RESIZE_DIRS.filter((d) => d.dx !== 0 && d.dy !== 0) : RESIZE_DIRS;

  return (
    <div
      style={{
        position: "absolute",
        left: displayX(field) * scale,
        top: displayY(field) * scale,
        width: w,
        height: h,
        transform: field.rotation ? `rotate(${field.rotation}deg)` : undefined,
        pointerEvents: "none",
        zIndex: 9997,
      }}
    >
      {EDGE_STRIPS.map((s) => (
        <div
          key={`strip-${s.dx},${s.dy}`}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (e.button === 0) onResize(e, field, s.dx, s.dy);
          }}
          style={{
            position: "absolute",
            cursor: s.cursor,
            pointerEvents: "auto",
            ...s.style,
          }}
        />
      ))}
      {dots.map((d) => (
        <div
          key={`dot-${d.dx},${d.dy}`}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (e.button === 0) onResize(e, field, d.dx, d.dy);
          }}
          style={{
            position: "absolute",
            width: 7,
            height: 7,
            marginLeft: -3.5,
            marginTop: -3.5,
            left: `${((d.dx + 1) / 2) * 100}%`,
            top: `${((d.dy + 1) / 2) * 100}%`,
            background: "#fff",
            border: "1px solid var(--editor-accent)",
            cursor: d.cursor,
            pointerEvents: "auto",
          }}
        />
      ))}
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          if (e.button === 0) onRotate(e, field);
        }}
        title="Rotate (shift snaps to 15°)"
        style={{
          position: "absolute",
          left: "50%",
          top: -22,
          width: 9,
          height: 9,
          marginLeft: -4.5,
          borderRadius: "50%",
          background: "#fff",
          border: "1px solid var(--editor-accent)",
          cursor: "grab",
          pointerEvents: "auto",
        }}
      />
    </div>
  );
}
