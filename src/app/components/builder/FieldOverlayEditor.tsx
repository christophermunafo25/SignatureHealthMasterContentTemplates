import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Moveable from "react-moveable";
import type { FieldType, TemplateField } from "@/lib/types";
import { useDataUrl } from "@/lib/render/useDataUrl";
import { useBrand } from "@/lib/brand/BrandContext";
import { loadGoogleFonts } from "@/lib/render/fonts";
import { resolveFieldStyle } from "@/lib/brand/resolveStyle";
import { cornerRadiusCss, FieldBox } from "../SchemaRenderer";
import { PALETTE_MIME } from "./fieldOps";

interface FieldOverlayEditorProps {
  canvasWidth: number;
  canvasHeight: number;
  backgroundUrl: string;
  fields: TemplateField[];
  selectedIds: string[];
  onSelect(ids: string[]): void;
  onChange(fields: TemplateField[]): void;
  /** Secondary path: the admin drew a raw box (canvas-space rect). */
  onDraw(rect: { x: number; y: number; width: number; height: number }): void;
  /** Primary path: a palette element was dropped at a canvas point. */
  onDropElement(type: FieldType, at: { x: number; y: number }): void;
  /** Right-click on a field (id) or empty canvas (null, with canvas point). */
  onContextMenu(pos: { x: number; y: number }, fieldId: string | null, canvasPoint: { x: number; y: number }): void;
}

interface DrawState {
  startX: number;
  startY: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

const GRID = 10; // canvas px

/** The Template Builder's design canvas. Figma-class editing via
 * react-moveable: drag to move, 8 resize handles (corner drags scale a text
 * field's font size with the box), rotation handle, snap-to-grid, and smart
 * alignment guides. Multi-select via shift/⌘-click (group drag). Palette
 * elements drop where released; drawing a box still works as a secondary
 * path. All coordinates commit in canvas pixel space (screen px ÷ scale). */
export function FieldOverlayEditor(props: FieldOverlayEditorProps) {
  const {
    canvasWidth,
    canvasHeight,
    backgroundUrl,
    fields,
    selectedIds,
    onSelect,
    onChange,
    onDraw,
    onDropElement,
    onContextMenu,
  } = props;
  const { kit } = useBrand();
  const containerRef = useRef<HTMLDivElement>(null);
  const boxRefs = useRef(new Map<string, HTMLDivElement>());
  const [scale, setScale] = useState(0.4);
  const [draw, setDraw] = useState<DrawState | null>(null);
  const resizeStart = useRef<{ height: number; fontSize?: number; corner: boolean }>({ height: 0, corner: false });
  const backgroundDataUrl = useDataUrl(backgroundUrl || undefined);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(el.offsetWidth / canvasWidth, 1));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [canvasWidth]);

  // The edit canvas shows real field content (name/placeholder in the real
  // styling), so the designed typefaces must load here too, not just in
  // preview mode.
  useEffect(() => {
    loadGoogleFonts(
      fields
        .map((f) => resolveFieldStyle(f, kit).fontFamily)
        .filter((f): f is string => Boolean(f)),
    );
  }, [fields, kit]);

  const toCanvas = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const rect = containerRef.current!.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(canvasWidth, (e.clientX - rect.left) / scale)),
        y: Math.max(0, Math.min(canvasHeight, (e.clientY - rect.top) / scale)),
      };
    },
    [scale, canvasWidth, canvasHeight],
  );

  const patchFields = useCallback(
    (patches: Map<string, Partial<TemplateField>>) =>
      onChange(fields.map((f) => (patches.has(f.id) ? { ...f, ...patches.get(f.id)! } : f))),
    [fields, onChange],
  );

  const selected = fields.filter((f) => selectedIds.includes(f.id));
  const single = selected.length === 1 ? selected[0] : null;

  // Target elements via state (not a render-time ref read): callback refs
  // populate AFTER render, so newly-added boxes need this second pass for
  // Moveable to mount on them.
  const [targetEls, setTargetEls] = useState<HTMLDivElement[]>([]);
  useEffect(() => {
    setTargetEls(
      selectedIds
        .map((id) => boxRefs.current.get(id))
        .filter((el): el is HTMLDivElement => Boolean(el)),
    );
  }, [selectedIds, fields, scale]);

  /** Editor always works in top-left space; center-anchored fields are
   * normalized on display and denormalized on commit. */
  const displayX = (f: TemplateField) => (f.anchor === "center" ? f.x - f.width / 2 : f.x);
  const displayY = (f: TemplateField) => (f.anchor === "center" ? f.y - f.height / 2 : f.y);
  const commitPos = (f: TemplateField, left: number, top: number, w = f.width, h = f.height) => ({
    x: Math.round(f.anchor === "center" ? left / scale + w / 2 : left / scale),
    y: Math.round(f.anchor === "center" ? top / scale + h / 2 : top / scale),
  });

  /** Commit every selected box's current on-screen position (group drag). */
  const commitGroupPositions = useCallback(() => {
    const patches = new Map<string, Partial<TemplateField>>();
    for (const f of fields) {
      if (!selectedIds.includes(f.id)) continue;
      const el = boxRefs.current.get(f.id);
      if (!el) continue;
      patches.set(f.id, commitPos(f, parseFloat(el.style.left), parseFloat(el.style.top)));
    }
    patchFields(patches);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, selectedIds, patchFields, scale]);

  const guidelineElements = useMemo(
    () =>
      fields
        .filter((f) => !selectedIds.includes(f.id))
        .map((f) => boxRefs.current.get(f.id))
        .filter((el): el is HTMLDivElement => Boolean(el)),
    // Refs are stable per id; recompute when the set or selection changes.
    [fields, selectedIds, scale],
  );

  const moveableProps = {
    container: containerRef.current,
    origin: false,
    throttleDrag: 0,
    snappable: true,
    snapThreshold: 6,
    snapGridWidth: GRID * scale,
    snapGridHeight: GRID * scale,
    elementGuidelines: guidelineElements,
    verticalGuidelines: [0, (canvasWidth * scale) / 2, canvasWidth * scale],
    horizontalGuidelines: [0, (canvasHeight * scale) / 2, canvasHeight * scale],
    elementSnapDirections: { top: true, bottom: true, left: true, right: true, center: true, middle: true },
    snapDirections: { top: true, bottom: true, left: true, right: true, center: true, middle: true },
  };

  return (
    <div
      ref={containerRef}
      data-overlay-root
      className="relative w-full select-none touch-none overflow-hidden"
      style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}`, cursor: "crosshair" }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(PALETTE_MIME)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(e) => {
        const type = e.dataTransfer.getData(PALETTE_MIME) as FieldType;
        if (!type) return;
        e.preventDefault();
        onDropElement(type, toCanvas(e));
      }}
      onContextMenu={(e) => {
        const target = e.target as HTMLElement;
        if (target !== e.currentTarget && target.dataset.role !== "bg") return;
        e.preventDefault();
        onContextMenu({ x: e.clientX, y: e.clientY }, null, toCanvas(e));
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target !== e.currentTarget && target.dataset.role !== "bg") return;
        const p = toCanvas(e);
        setDraw({ startX: p.x, startY: p.y, x: p.x, y: p.y, w: 0, h: 0 });
        onSelect([]);
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          // Pointer capture is best-effort (synthetic/secondary pointers).
        }
      }}
      onPointerMove={(e) => {
        if (!draw) return;
        const p = toCanvas(e);
        setDraw({
          ...draw,
          x: Math.min(draw.startX, p.x),
          y: Math.min(draw.startY, p.y),
          w: Math.abs(p.x - draw.startX),
          h: Math.abs(p.y - draw.startY),
        });
      }}
      onPointerUp={() => {
        if (draw && draw.w > 24 && draw.h > 24) {
          onDraw({
            x: Math.round(draw.x),
            y: Math.round(draw.y),
            width: Math.round(draw.w),
            height: Math.round(draw.h),
          });
        }
        setDraw(null);
      }}
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
          background: "#fff",
          pointerEvents: "none",
        }}
      >
        {backgroundDataUrl && (
          <img
            src={backgroundDataUrl}
            alt=""
            data-role="bg"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {/* Real field content (name/placeholder, real styling, dimmed) — the
            same FieldBox the preview/member page/export renders, so the edit
            canvas always matches. Lives in the scaled canvas layer, so it
            tracks the boxes exactly. */}
        {fields.map((f) => (
          <FieldBox key={f.id} field={f} value={undefined} brandKit={kit} />
        ))}
      </div>

      {/* Field boxes (screen space = canvas × scale; z = canvas layer order) */}
      {fields.map((f) => {
        const isSelected = selectedIds.includes(f.id);
        return (
          <div
            key={f.id}
            ref={(el) => {
              if (el) boxRefs.current.set(f.id, el);
              else boxRefs.current.delete(f.id);
            }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              if (e.shiftKey || e.metaKey || e.ctrlKey) {
                onSelect(
                  isSelected ? selectedIds.filter((id) => id !== f.id) : [...selectedIds, f.id],
                );
              } else if (!isSelected) {
                onSelect([f.id]);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isSelected) onSelect([f.id]);
              onContextMenu({ x: e.clientX, y: e.clientY }, f.id, toCanvas(e));
            }}
            style={{
              position: "absolute",
              left: displayX(f) * scale,
              top: displayY(f) * scale,
              width: f.width * scale,
              height: f.height * scale,
              zIndex: (f.zIndex ?? 0) + 1, // +1 keeps every box above the background
              transform: f.rotation ? `rotate(${f.rotation}deg)` : undefined,
              border: isSelected ? "1.5px solid #2563EB" : "1.5px dashed rgba(37,99,235,0.65)",
              borderRadius: f.type === "image" ? cornerRadiusCss(f) : undefined,
              // Content renders beneath in the canvas layer — keep the
              // interactive box a near-transparent outline so text stays legible.
              background: isSelected ? "rgba(37,99,235,0.06)" : "transparent",
              cursor: "move",
            }}
          >
            <span
              className="absolute -top-5 left-0 text-[10px] font-bold px-1 rounded whitespace-nowrap"
              style={{ background: "#2563EB", color: "white", pointerEvents: "none" }}
            >
              {f.label} · {f.static ? "fixed" : f.type}
            </span>
          </div>
        );
      })}

      {/* Figma-class transform controls: full controls on a single selection,
          group drag on a multi-selection */}
      {single && targetEls.length === 1 && (
        <Moveable
          key={`${single.id}-${scale}`}
          target={targetEls[0]}
          {...moveableProps}
          draggable
          resizable
          rotatable
          throttleResize={0}
          throttleRotate={0}
          renderDirections={["nw", "n", "ne", "e", "se", "s", "sw", "w"]}
          onDrag={(e) => {
            e.target.style.left = `${e.left}px`;
            e.target.style.top = `${e.top}px`;
          }}
          onDragEnd={(e) => {
            if (!e.lastEvent) return;
            patchFields(new Map([[single.id, commitPos(single, e.lastEvent.left, e.lastEvent.top)]]));
          }}
          onResizeStart={(e) => {
            resizeStart.current = {
              height: single.height,
              fontSize: single.fontSizePx,
              corner: e.direction[0] !== 0 && e.direction[1] !== 0,
            };
          }}
          onResize={(e) => {
            e.target.style.width = `${e.width}px`;
            e.target.style.height = `${e.height}px`;
            e.target.style.left = `${e.drag.left}px`;
            e.target.style.top = `${e.drag.top}px`;
          }}
          onResizeEnd={(e) => {
            if (!e.lastEvent) return;
            const w = Math.max(16, Math.round(e.lastEvent.width / scale));
            const h = Math.max(16, Math.round(e.lastEvent.height / scale));
            const patch: Partial<TemplateField> = {
              width: w,
              height: h,
              ...commitPos(single, e.lastEvent.drag.left, e.lastEvent.drag.top, w, h),
            };
            // Corner drags scale text like a design tool: font follows the box.
            const start = resizeStart.current;
            const isText = single.type === "text" || single.type === "multiline" || single.type === "select";
            if (start.corner && isText && start.height > 0) {
              const base = start.fontSize ?? 45;
              patch.fontSizePx = Math.max(6, Math.round(base * (h / start.height)));
            }
            patchFields(new Map([[single.id, patch]]));
          }}
          onRotate={(e) => {
            e.target.style.transform = `rotate(${e.rotation}deg)`;
          }}
          onRotateEnd={(e) => {
            if (!e.lastEvent) return;
            const deg = Math.round(e.lastEvent.rotation) % 360;
            patchFields(new Map([[single.id, { rotation: deg === 0 ? undefined : deg }]]));
          }}
        />
      )}
      {selected.length > 1 && targetEls.length > 1 && (
        <Moveable
          key={`group-${selectedIds.join(",")}-${scale}`}
          target={targetEls}
          {...moveableProps}
          draggable
          onDragGroup={(e) => {
            e.events.forEach((ev) => {
              ev.target.style.left = `${ev.left}px`;
              ev.target.style.top = `${ev.top}px`;
            });
          }}
          onDragGroupEnd={commitGroupPositions}
        />
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
            border: "2px dashed #2563EB",
            background: "rgba(37,99,235,0.08)",
            pointerEvents: "none",
            zIndex: 10000,
          }}
        />
      )}
    </div>
  );
}
