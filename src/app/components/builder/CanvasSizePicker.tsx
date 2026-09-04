import React, { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import type { CanvasPreset } from "@/lib/types";

/** Wizard stage before the canvas on the Start-blank path: pick the size by
 * platform. The chosen dimensions are applied with resetHistory (never
 * setDraft) so undo can't reshape the canvas. */
export function CanvasSizePicker({
  presets,
  onPick,
  onBack,
}: {
  presets: CanvasPreset[];
  onPick(preset: CanvasPreset): void;
  onBack(): void;
}) {
  const groups = useMemo(() => {
    const by = new Map<string, CanvasPreset[]>();
    for (const p of [...presets].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const list = by.get(p.platform) ?? [];
      list.push(p);
      by.set(p.platform, list);
    }
    return [...by.entries()];
  }, [presets]);

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5" style={{ fontSize: 13, color: "var(--fg-2)" }}>
        <ArrowLeft style={{ width: 14, height: 14 }} />
        Back
      </button>
      <div className="text-center space-y-1">
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em", color: "var(--ink)" }}>
          Pick a canvas size
        </h2>
        <p style={{ fontSize: 13, color: "var(--fg-2)" }}>
          Sized for where it will be posted. The size is locked once the
          template is built.
        </p>
      </div>
      {groups.map(([platform, rows]) => (
        <div key={platform} className="space-y-2">
          <p className="sp-eyebrow">{platform}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {rows.map((p) => {
              // Scaled swatch so the shape reads at a glance.
              const ratio = p.width / p.height;
              const w = ratio >= 1 ? 64 : Math.round(64 * ratio);
              const h = ratio >= 1 ? Math.round(64 / ratio) : 64;
              return (
                <button
                  key={p.id}
                  onClick={() => onPick(p)}
                  className="p-4 flex flex-col items-center gap-2 transition-all"
                  style={{
                    border: "1px solid var(--hairline)",
                    borderRadius: "var(--radius-card-sm)",
                    background: "var(--lift)",
                    boxShadow: "var(--shadow-e1)",
                    cursor: "pointer",
                  }}
                >
                  <span
                    className="flex items-end justify-center"
                    style={{ height: 64 }}
                    aria-hidden
                  >
                    <span
                      style={{
                        width: w,
                        height: h,
                        background: "var(--surface-sunken)",
                        border: "1.5px solid var(--hairline-strong)",
                        borderRadius: 4,
                        display: "block",
                      }}
                    />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                    {p.format || p.label}
                    {p.recommended && (
                      <span
                        className="ml-1.5 rounded-full px-1.5 py-0.5"
                        style={{ fontSize: 9, fontFamily: "var(--font-mono)", background: "var(--accent-wash)", color: "var(--ink)" }}
                      >
                        RECOMMENDED
                      </span>
                    )}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>
                    {p.width}×{p.height}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
