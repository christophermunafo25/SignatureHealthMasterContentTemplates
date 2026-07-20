import React, { useCallback, useEffect, useRef, useState } from "react";
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

type DragState =
  | { kind: "draw"; startX: number; startY: number; x: number; y: number; w: number; h: number }
  | { kind: "move"; id: string; offsetX: number; offsetY: number }
  | { kind: "resize"; id: string };

/** The Template Builder's mapping surface: the uploaded background rendered
 * at scale with draggable/resizable field boxes in canvas coordinate space.
 * Drag on empty canvas to draw a new field box; drag a box to move it; use
 * the corner handle to resize. All math happens in canvas pixels (divide by
 * scale), mirroring the SchemaRenderer coordinate system exactly. */
export function FieldOverlayEditor(props: FieldOverlayEditorProps) {
  const { canvasWidth, canvasHeight, backgroundUrl, fields, selectedId, onSelect, onChange, onDraw } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const [drag, setDrag] = useState<DragState | null>(null);
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

  const updateField = (id: string, patch: Partial<TemplateField>) =>
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toCanvas(e);
    if (drag.kind === "draw") {
      setDrag({
        ...drag,
        x: Math.min(drag.startX, p.x),
        y: Math.min(drag.startY, p.y),
        w: Math.abs(p.x - drag.startX),
        h: Math.abs(p.y - drag.startY),
      });
    } else if (drag.kind === "move") {
      updateField(drag.id, {
        x: Math.round(p.x - drag.offsetX),
        y: Math.round(p.y - drag.offsetY),
      });
    } else {
      const f = fields.find((f) => f.id === drag.id);
      if (f) {
        updateField(drag.id, {
          width: Math.max(24, Math.round(p.x - f.x)),
          height: Math.max(24, Math.round(p.y - f.y)),
        });
      }
    }
  };

  const handlePointerUp = () => {
    if (drag?.kind === "draw") {
      if (drag.w > 24 && drag.h > 24) {
        onDraw({ x: Math.round(drag.x), y: Math.round(drag.y), width: Math.round(drag.w), height: Math.round(drag.h) });
      } else {
        onSelect(null);
      }
    }
    setDrag(null);
  };

  return (
    <div
      ref={containerRef}
      data-overlay-root
      className="relative w-full select-none touch-none"
      style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}`, cursor: "crosshair" }}
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget && (e.target as HTMLElement).dataset.role !== "bg") return;
        const p = toCanvas(e);
        setDrag({ kind: "draw", startX: p.x, startY: p.y, x: p.x, y: p.y, w: 0, h: 0 });
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
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

      {/* Field boxes (screen space = canvas * scale) */}
      {fields.map((f) => {
        const selected = f.id === selectedId;
        return (
          <div
            key={f.id}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect(f.id);
              const p = toCanvas(e);
              setDrag({ kind: "move", id: f.id, offsetX: p.x - f.x, offsetY: p.y - f.y });
              (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId);
            }}
            style={{
              position: "absolute",
              left: f.x * scale,
              top: f.y * scale,
              width: f.width * scale,
              height: f.height * scale,
              transform: [
                f.anchor === "center" ? "translate(-50%, -50%)" : "",
                f.rotation ? `rotate(${f.rotation}deg)` : "",
              ].join(" "),
              border: selected ? "2px solid #2563EB" : "1.5px dashed rgba(37,99,235,0.65)",
              background: selected ? "rgba(37,99,235,0.12)" : "rgba(37,99,235,0.05)",
              cursor: "move",
            }}
          >
            <span
              className="absolute -top-5 left-0 text-[10px] font-bold px-1 rounded whitespace-nowrap"
              style={{ background: "#2563EB", color: "white" }}
            >
              {f.label} · {f.type}
            </span>
            {selected && (
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setDrag({ kind: "resize", id: f.id });
                  (e.currentTarget.closest("[data-overlay-root]") as HTMLElement).setPointerCapture(e.pointerId);
                }}
                style={{
                  position: "absolute",
                  right: -6,
                  bottom: -6,
                  width: 12,
                  height: 12,
                  background: "#2563EB",
                  borderRadius: 3,
                  cursor: "nwse-resize",
                }}
              />
            )}
          </div>
        );
      })}

      {/* Draw preview */}
      {drag?.kind === "draw" && drag.w > 4 && (
        <div
          style={{
            position: "absolute",
            left: drag.x * scale,
            top: drag.y * scale,
            width: drag.w * scale,
            height: drag.h * scale,
            border: "2px dashed #2563EB",
            background: "rgba(37,99,235,0.08)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
