import React, { useRef } from "react";
import type { TemplateField } from "@/lib/types";

interface CaptionEditorProps {
  value: string;
  fields: TemplateField[];
  onChange(value: string): void;
}

/** Caption merge-template editor with insertable {field_key} tags. */
export function CaptionEditor({ value, fields, onChange }: CaptionEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insertTag = (fieldKey: string) => {
    const el = ref.current;
    const tag = `{${fieldKey}}`;
    if (!el) {
      onChange(value + tag);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + tag + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    });
  };

  const taggable = fields.filter((f) => f.type !== "image");

  return (
    <div className="space-y-2">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="e.g. Join us in congratulating {name} on {years} incredible years at {location}!"
        className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
        style={{ borderColor: "var(--border)", background: "var(--input-background)", color: "var(--foreground)" }}
      />
      {taggable.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
            Insert:
          </span>
          {taggable.map((f) => (
            <button
              key={f.id}
              onClick={() => insertTag(f.fieldKey)}
              className="text-[11px] font-mono px-2 py-1 rounded-md"
              style={{ background: "var(--secondary)", color: "var(--secondary-foreground)" }}
            >
              {"{"}{f.fieldKey}{"}"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
