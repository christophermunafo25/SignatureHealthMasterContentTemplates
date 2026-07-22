import React from "react";
import { AlignLeft, ChevronDown, Image as ImageIcon, Type as TypeIcon } from "lucide-react";
import type { FieldType } from "@/lib/types";
import { PALETTE_ITEMS, PALETTE_MIME } from "./fieldOps";

const ICONS: Record<FieldType, React.ComponentType<{ style?: React.CSSProperties }>> = {
  text: TypeIcon,
  multiline: AlignLeft,
  image: ImageIcon,
  select: ChevronDown,
};

interface ElementPaletteProps {
  /** Click fallback: adds the element at the canvas center. */
  onAdd(type: FieldType): void;
}

/** The Fields step's element palette. Drag a tile onto the canvas to drop a
 * pre-sized, pre-typed field where it lands (works on both the PNG and the
 * Figma path); clicking a tile adds it at the canvas center. */
export function ElementPalette({ onAdd }: ElementPaletteProps) {
  return (
    <div className="sp-card p-3 space-y-2">
      <h3 className="sp-eyebrow">Elements</h3>
      {/* When the builder stacks to one column (below lg), the palette spans
          the full content width — four-across keeps the tiles hand-sized. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
        {PALETTE_ITEMS.map((item) => {
          const Icon = ICONS[item.type];
          return (
            <button
              key={item.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(PALETTE_MIME, item.type);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => onAdd(item.type)}
              title={`Drag onto the canvas, or click to add at the center`}
              className="flex flex-col items-center gap-1.5 py-3 px-2 transition-colors"
              style={{
                border: "1px solid var(--hairline-strong)",
                borderRadius: "var(--radius-card-sm, 10px)",
                background: "var(--lift)",
                cursor: "grab",
                fontSize: 11,
                color: "var(--fg-2)",
              }}
            >
              <Icon style={{ width: 16, height: 16, color: "var(--solar)" }} />
              {item.label}
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 11, color: "var(--fg-3)" }}>
        Drag an element onto the canvas — it drops where you release it and
        opens for naming.
      </p>
    </div>
  );
}
