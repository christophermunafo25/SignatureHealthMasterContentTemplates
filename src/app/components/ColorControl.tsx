import React, { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

interface ColorControlProps {
  value: string | undefined; // #RRGGBB
  onChange(hex: string): void;
  /** Show a clear affordance and allow returning to "no color". */
  onClear?: () => void;
  size?: number; // swatch px
  ariaLabel?: string;
}

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;

/** The app-wide color control: a swatch that is OBVIOUSLY editable (hover
 * pencil + pointer + tooltip) paired with a visible, editable hex input.
 * The native color picker opens from the swatch. Used everywhere a color is
 * set — Brand Studio palette, field colors, gradient stops, onboarding. */
export function ColorControl({ value, onChange, onClear, size = 32, ariaLabel }: ColorControlProps) {
  const [draft, setDraft] = useState(value ?? "");
  const [hover, setHover] = useState(false);
  const nativeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commitDraft = () => {
    const m = HEX_RE.exec(draft.trim());
    if (m) onChange(`#${m[1].toUpperCase()}`);
    else setDraft(value ?? ""); // revert invalid input
  };

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        title="Click to edit color"
        aria-label={ariaLabel ?? "Edit color"}
        onClick={() => nativeRef.current?.click()}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="relative flex-shrink-0 cursor-pointer"
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          border: hover ? "2px solid var(--solar)" : "1px solid var(--hairline-strong)",
          background: value
            ? value
            : "repeating-conic-gradient(#e5e5e5 0% 25%, #ffffff 0% 50%) 0 0 / 10px 10px",
          transition: "border-color 0.15s",
        }}
      >
        {hover && (
          <span
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(35,31,35,0.35)", borderRadius: 6 }}
          >
            <Pencil style={{ width: Math.max(11, size * 0.38), height: Math.max(11, size * 0.38), color: "#fff" }} />
          </span>
        )}
        <input
          ref={nativeRef}
          type="color"
          value={value ?? "#888888"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="absolute inset-0 opacity-0 cursor-pointer"
          tabIndex={-1}
          aria-hidden
        />
      </button>
      <input
        type="text"
        value={draft}
        placeholder="#RRGGBB"
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => e.key === "Enter" && commitDraft()}
        className="sp-input"
        style={{ width: 88, fontFamily: "var(--font-mono)", fontSize: 12, padding: "5px 8px" }}
        aria-label={`${ariaLabel ?? "Color"} hex value`}
      />
      {onClear && value && (
        <button
          type="button"
          onClick={onClear}
          style={{ fontSize: 11, color: "var(--fg-3)" }}
          title="Remove color"
        >
          Clear
        </button>
      )}
    </div>
  );
}
