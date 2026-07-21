import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Moveable from "react-moveable";
import type { TemplateField } from "@/lib/types";
import { useDataUrl } from "@/lib/render/useDataUrl";

interface FieldOverlayEditorProps {
  canvasWidth: number;
  canvasHeight: number;
  backgroundUrl: string;
  fields: TemplateField[];
  selectedId: string | null;
  onSelect(id: string | null): void;
  onChange(fields: TemplateField[]): void;
  /** Called when the admin draws a new box (canvas-space rect). */
  onDraw(rect: { x: number; y: number; width: number; height: number }): void;
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
 * alignment guides against the canvas edges/center and every other field.
 * Drag on empty canvas to draw a new field. All coordinates commit in canvas
 * pixel space (screen px ÷ scale). */
export function FieldOverlayEditor(props: FieldOverlayEditorProps) {
  const { canvasWidth, canvasHeight, backgroundUrl, fields, selectedId, onSelect, onChange, onDraw } = props;
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

  const patchField = useCallback(
    (id: string, patch: Partial<TemplateField>) =>
      onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f))),
    [fields, onChange],
  );

  // Delete/Backspace removes the selected field (unless typing in an input).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedId) return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onChange(fields.filter((f) => f.id !== selectedId));
        onSelect(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, fields, onChange, onSelect]);

  const selected = fields.find((f) => f.id === selectedId) ?? null;
  // Target element via state (not a render-time ref read): callback refs
  // populate AFTER render, so a newly-drawn box needs this second pass for
  // Moveable to mount on it.
  const [selectedEl, setSelectedEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    setSelectedEl(selectedId ? (boxRefs.current.get(selectedId) ?? null) : null);
  }, [selectedId, fields, scale]);

  /** Editor always works in top-left space; center-anchored fields are
   * normalized on display and denormalized on commit. */
  const displayX = (f: TemplateField) => (f.anchor === "center" ? f.x - f.width / 2 : f.x);
  const displayY = (f: TemplateField) => (f.anchor === "center" ? f.y - f.height / 2 : f.y);
  const commitPos = (f: TemplateField, left: number, top: number, w = f.width, h = f.height) => ({
    x: Math.round(f.anchor === "center" ? left / scale + w / 2 : left / scale),
    y: Math.round(f.anchor === "center" ? top / scale + h / 2 : top / scale),
  });

  const guidelineElements = useMemo(
    () =>
      fields
        .filter((f) => f.id !== selectedId)
        .map((f) => boxRefs.current.get(f.id))
        .filter((el): el is HTMLDivElement => Boolean(el)),
    // Refs are stable per id; recompute when the set or selection changes.
    [fields, selectedId, scale],
  );

  return (
    <div
      ref={containerRef}
      data-overlay-root
      className="relative w-full select-none touch-none overflow-hidden"
      style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}`, cursor: "crosshair" }}
      onPointerDown={(e) => {
        const target = e.target as HTMLElement;
        if (target !== e.currentTarget && target.dataset.role !== "bg") return;
        const p = toCanvas(e);
        setDraw({ startX: p.x, startY: p.y, x: p.x, y: p.y, w: 0, h: 0 });
        onSelect(null);
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
      </div>

      {/* Field boxes (screen space = canvas × scale) */}
      {fields.map((f) => {
        const isSelected = f.id === selectedId;
        return (
          <div
            key={f.id}
            ref={(el) => {
              if (el) boxRefs.current.set(f.id, el);
              else boxRefs.current.delete(f.id);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect(f.id);
            }}
            style={{
              position: "absolute",
              left: displayX(f) * scale,
              top: displayY(f) * scale,
              width: f.width * scale,
              height: f.height * scale,
              transform: f.rotation ? `rotate(${f.rotation}deg)` : undefined,
              border: isSelected ? "1.5px solid #2563EB" : "1.5px dashed rgba(37,99,235,0.65)",
              background: isSelected ? "rgba(37,99,235,0.08)" : "rgba(37,99,235,0.04)",
              cursor: "move",
            }}
          >
            <span
              className="absolute -top-5 left-0 text-[10px] font-bold px-1 rounded whitespace-nowrap"
              style={{ background: "#2563EB", color: "white", pointerEvents: "none" }}
            >
              {f.label} · {f.type}
            </span>
          </div>
        );
      })}

      {/* Figma-class transform controls on the selected box */}
      {selected && selectedEl && (
        <Moveable
          key={`${selected.id}-${scale}`}
          target={selectedEl}
          container={containerRef.current}
          origin={false}
          draggable
          resizable
          rotatable
          throttleDrag={0}
          throttleResize={0}
          throttleRotate={0}
          renderDirections={["nw", "n", "ne", "e", "se", "s", "sw", "w"]}
          snappable
          snapThreshold={6}
          snapGridWidth={GRID * scale}
          snapGridHeight={GRID * scale}
          elementGuidelines={guidelineElements}
          verticalGuidelines={[0, (canvasWidth * scale) / 2, canvasWidth * scale]}
          horizontalGuidelines={[0, (canvasHeight * scale) / 2, canvasHeight * scale]}
          elementSnapDirections={{ top: true, bottom: true, left: true, right: true, center: true, middle: true }}
          snapDirections={{ top: true, bottom: true, left: true, right: true, center: true, middle: true }}
          onDrag={(e) => {
            e.target.style.left = `${e.left}px`;
            e.target.style.top = `${e.top}px`;
          }}
          onDragEnd={(e) => {
            if (!e.lastEvent) return;
            patchField(selected.id, commitPos(selected, e.lastEvent.left, e.lastEvent.top));
          }}
          onResizeStart={(e) => {
            resizeStart.current = {
              height: selected.height,
              fontSize: selected.fontSizePx,
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
              ...commitPos(selected, e.lastEvent.drag.left, e.lastEvent.drag.top, w, h),
            };
            // Corner drags scale text like a design tool: font follows the box.
            const start = resizeStart.current;
            const isText = selected.type === "text" || selected.type === "multiline" || selected.type === "select";
            if (start.corner && isText && start.height > 0) {
              const base = start.fontSize ?? 45;
              patch.fontSizePx = Math.max(6, Math.round(base * (h / start.height)));
            }
            patchField(selected.id, patch);
          }}
          onRotate={(e) => {
            e.target.style.transform = `rotate(${e.rotation}deg)`;
          }}
          onRotateEnd={(e) => {
            if (!e.lastEvent) return;
            const deg = Math.round(e.lastEvent.rotation) % 360;
            patchField(selected.id, { rotation: deg === 0 ? undefined : deg });
          }}
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
          }}
        />
      )}
    </div>
  );
}
