import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { RefreshCw, Upload } from "lucide-react";
import type { Location, TemplateField } from "@/lib/types";
import { ImageCropper } from "./ImageCropper";

interface FieldInputProps {
  field: TemplateField;
  value: string;
  onChange(value: string): void;
  locations: Location[];
}

/** Member input for one template field. Enforces the field's guardrails
 * (maxLength, aspect-ratio crop, fixed options) — content only, never style. */
export function FieldInput({ field, value, onChange, locations }: FieldInputProps) {
  switch (field.type) {
    case "text":
      return (
        <input
          type="text"
          value={value}
          maxLength={field.maxLength}
          placeholder={field.placeholder ?? field.label}
          onChange={(e) => onChange(e.target.value)}
          className="sp-input"
        />
      );
    case "multiline":
      return (
        <textarea
          value={value}
          maxLength={field.maxLength}
          placeholder={field.placeholder ?? field.label}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="sp-input"
          style={{ resize: "vertical" }}
        />
      );
    case "select":
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className="sp-input">
          <option value="">Select…</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "location":
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className="sp-input">
          <option value="">Select a location…</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      );
    case "image":
      return <ImageFieldInput field={field} value={value} onChange={onChange} />;
  }
}

function ImageFieldInput({ field, value, onChange }: Omit<FieldInputProps, "locations">) {
  const [original, setOriginal] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setOriginal(reader.result as string);
      setCropping(true);
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxFiles: 1,
  });

  const aspect = field.aspectRatio ?? field.width / field.height;

  return (
    <>
      {cropping && original && (
        <ImageCropper
          imageSrc={original}
          aspect={aspect}
          onCancel={() => setCropping(false)}
          onCropComplete={(cropped) => {
            onChange(cropped);
            setCropping(false);
          }}
        />
      )}
      <div
        {...getRootProps()}
        className="text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
        style={{
          border: `1.5px dashed ${isDragActive ? "var(--solar)" : "var(--hairline-strong)"}`,
          borderRadius: "var(--radius-input)",
          background: isDragActive ? "rgba(255,63,0,0.05)" : "var(--lift)",
          padding: 14,
        }}
      >
        <input {...getInputProps()} />
        {value ? (
          <div
            className="relative w-16 h-16 overflow-hidden"
            style={{ borderRadius: 8, border: "1px solid var(--hairline)", boxShadow: "var(--shadow-e1)" }}
          >
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <RefreshCw className="w-4 h-4 text-white" />
            </div>
          </div>
        ) : (
          <span
            className="flex items-center justify-center"
            style={{ width: 36, height: 36, borderRadius: "var(--radius-icon)", background: "var(--peach)" }}
          >
            <Upload style={{ width: 15, height: 15, color: "var(--ink)" }} />
          </span>
        )}
        <p style={{ fontSize: 12, color: "var(--fg-2)" }}>
          {value ? "Replace image" : "Click or drag to upload"}
        </p>
      </div>
    </>
  );
}
