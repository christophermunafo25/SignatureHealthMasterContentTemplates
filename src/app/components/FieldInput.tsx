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

const inputClass =
  "w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 transition";
const inputStyle: React.CSSProperties = {
  borderColor: "var(--border)",
  background: "var(--input-background)",
  color: "var(--foreground)",
};

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
          className={inputClass}
          style={inputStyle}
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
          className={inputClass}
          style={inputStyle}
        />
      );
    case "select":
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} style={inputStyle}>
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
        <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} style={inputStyle}>
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
        className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 group"
        style={{
          borderColor: isDragActive ? "var(--primary)" : "var(--border)",
          background: isDragActive ? "var(--secondary)" : undefined,
        }}
      >
        <input {...getInputProps()} />
        {value ? (
          <div className="relative w-16 h-16 rounded-lg overflow-hidden border-2 shadow" style={{ borderColor: "var(--border)" }}>
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <RefreshCw className="w-4 h-4 text-white" />
            </div>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--secondary)" }}>
            <Upload className="w-4 h-4" style={{ color: "var(--primary)" }} />
          </div>
        )}
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>
          {value ? "Replace image" : "Click or drag to upload"}
        </p>
      </div>
    </>
  );
}
