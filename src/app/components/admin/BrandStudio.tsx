import React, { useEffect, useState } from "react";
import { Check, Plus, Star, Trash2, Upload } from "lucide-react";
import type { BrandColor, FontRef } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { GOOGLE_FONTS, loadGoogleFonts, registerCustomFont } from "@/lib/render/fonts";
import { FONT_ACCEPT, validateFontFile } from "@/lib/brand/fontUpload";
import { DEFAULT_PALETTE } from "@/lib/theme";

/** Brand Studio: the company's palette, fonts (Google + uploaded), and logos.
 * Every template field styles itself from here — nothing is hardcoded. */
export function BrandStudio() {
  const { company } = useAuth();
  const { kit, assets, refresh } = useBrand();

  const [colors, setColors] = useState<BrandColor[]>(kit?.colors ?? DEFAULT_PALETTE);
  const [headingFont, setHeadingFont] = useState<FontRef>(kit?.headingFont ?? { source: "google", family: "Montserrat" });
  const [bodyFont, setBodyFont] = useState<FontRef>(kit?.bodyFont ?? { source: "google", family: "Inter" });
  const [primaryLogoAssetId, setPrimaryLogoAssetId] = useState(kit?.primaryLogoAssetId);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (kit) {
      setColors(kit.colors);
      if (kit.headingFont) setHeadingFont(kit.headingFont);
      if (kit.bodyFont) setBodyFont(kit.bodyFont);
      setPrimaryLogoAssetId(kit.primaryLogoAssetId);
    }
  }, [kit]);

  const fontAssets = assets.filter((a) => a.kind === "font");
  const logoAssets = assets.filter((a) => a.kind === "logo");

  const save = async () => {
    if (!company) return;
    setSaving(true);
    setError(null);
    try {
      await stores.brandKits.upsert(company.id, { colors, headingFont, bodyFont, primaryLogoAssetId });
      await refresh(); // re-theme the app + reload fonts immediately
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const uploadFont = async (file: File) => {
    if (!company) return;
    const check = validateFontFile(file);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);
    const asset = await stores.brandAssets.upload(company.id, "font", file, check.metadata);
    await registerCustomFont(asset); // usable immediately, export-safe
    await refresh();
  };

  const uploadLogo = async (file: File) => {
    if (!company) return;
    const asset = await stores.brandAssets.upload(company.id, "logo", file);
    if (!logoAssets.length) setPrimaryLogoAssetId(asset.id);
    await refresh();
  };

  const fontOptions = (current: FontRef, set: (r: FontRef) => void) => (
    <select
      value={current.source === "custom" ? `custom:${current.assetId}` : `google:${current.family}`}
      onChange={(e) => {
        const [source, value] = e.target.value.split(":");
        if (source === "google") {
          loadGoogleFonts([value]);
          set({ source: "google", family: value });
        } else {
          const asset = fontAssets.find((a) => a.id === value);
          if (asset) set({ source: "custom", family: asset.metadata.family ?? asset.name, assetId: asset.id });
        }
      }}
      className="w-full rounded-xl border px-3 py-2.5 text-sm"
      style={{ borderColor: "var(--border)", background: "var(--input-background)", color: "var(--foreground)" }}
    >
      {fontAssets.length > 0 && (
        <optgroup label="Your uploaded fonts">
          {fontAssets.map((a) => (
            <option key={a.id} value={`custom:${a.id}`}>{a.metadata.family ?? a.name}</option>
          ))}
        </optgroup>
      )}
      <optgroup label="Google Fonts">
        {GOOGLE_FONTS.map((f) => (
          <option key={f} value={`google:${f}`}>{f}</option>
        ))}
      </optgroup>
    </select>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-extrabold uppercase text-xl" style={{ color: "var(--foreground)" }}>Brand Studio</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Colors, fonts, and logos every template inherits.
          </p>
        </div>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="flex items-center gap-2 font-bold uppercase text-xs tracking-[0.18em] px-5 py-3 rounded-xl shadow-md disabled:opacity-60"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {savedTick ? <Check className="w-4 h-4" /> : null}
          {savedTick ? "Saved" : saving ? "Saving…" : "Save brand"}
        </button>
      </div>

      {error && (
        <p className="mb-5 text-sm rounded-xl px-4 py-3" style={{ background: "#FBE9E9", color: "var(--destructive)" }}>
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colors */}
        <section className="bg-white rounded-2xl border p-6 space-y-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-extrabold uppercase text-sm" style={{ color: "var(--foreground)" }}>Colors</h2>
          <div className="space-y-2.5">
            {colors.map((c, i) => (
              <div key={c.key} className="flex items-center gap-3">
                <input
                  type="color"
                  value={c.hex}
                  onChange={(e) => setColors(colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                  aria-label={`${c.name} color`}
                />
                <input
                  value={c.name}
                  onChange={(e) => setColors(colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  className="text-sm font-semibold flex-1 bg-transparent outline-none"
                  style={{ color: "var(--foreground)" }}
                />
                <span className="font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>{c.hex}</span>
                {!DEFAULT_PALETTE.some((d) => d.key === c.key) && (
                  <button onClick={() => setColors(colors.filter((_, j) => j !== i))} aria-label={`Remove ${c.name}`}>
                    <Trash2 className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              const n = colors.filter((c) => c.key.startsWith("custom")).length + 1;
              setColors([...colors, { key: `custom_${n}`, name: `Custom ${n}`, hex: "#888888" }]);
            }}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider"
            style={{ color: "var(--primary)" }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add color
          </button>
        </section>

        {/* Fonts */}
        <section className="bg-white rounded-2xl border p-6 space-y-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-extrabold uppercase text-sm" style={{ color: "var(--foreground)" }}>Fonts</h2>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--muted-foreground)" }}>
              Heading
            </label>
            {fontOptions(headingFont, setHeadingFont)}
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--muted-foreground)" }}>
              Body
            </label>
            {fontOptions(bodyFont, setBodyFont)}
          </div>
          <label
            className="flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-3 cursor-pointer text-[11px] font-bold uppercase tracking-wider"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
          >
            <Upload className="w-4 h-4" />
            Upload font file
            <input
              type="file"
              accept={FONT_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                for (const f of Array.from(e.target.files ?? [])) void uploadFont(f);
                e.target.value = "";
              }}
            />
          </label>
          {fontAssets.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--foreground)", fontFamily: `"${a.metadata.family ?? a.name}"` }}>
                {a.metadata.family ?? a.name}
              </span>
              <button
                onClick={() => void stores.brandAssets.remove(a.id).then(refresh)}
                aria-label={`Remove ${a.name}`}
              >
                <Trash2 className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
              </button>
            </div>
          ))}
        </section>

        {/* Logos */}
        <section className="bg-white rounded-2xl border p-6 space-y-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-extrabold uppercase text-sm" style={{ color: "var(--foreground)" }}>Logos</h2>
          <div className="grid grid-cols-3 gap-3">
            {logoAssets.map((a) => (
              <div
                key={a.id}
                className="relative rounded-xl border p-3 flex items-center justify-center aspect-square"
                style={{ borderColor: a.id === primaryLogoAssetId ? "var(--primary)" : "var(--border)" }}
              >
                <img src={a.url} alt={a.name} className="max-w-full max-h-full object-contain" />
                <button
                  onClick={() => setPrimaryLogoAssetId(a.id)}
                  title="Make primary"
                  className="absolute top-1.5 right-1.5"
                >
                  <Star
                    className="w-4 h-4"
                    style={{ color: a.id === primaryLogoAssetId ? "var(--accent)" : "var(--border)" }}
                    fill={a.id === primaryLogoAssetId ? "currentColor" : "none"}
                  />
                </button>
                <button
                  onClick={() => void stores.brandAssets.remove(a.id).then(refresh)}
                  className="absolute bottom-1.5 right-1.5"
                  aria-label={`Remove ${a.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
                </button>
              </div>
            ))}
            <label
              className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center aspect-square cursor-pointer gap-1"
              style={{ borderColor: "var(--border)" }}
            >
              <Upload className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />
              <span className="text-[9px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Add logo</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadLogo(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </section>

        {/* Live preview */}
        <section className="bg-white rounded-2xl border p-6 space-y-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-extrabold uppercase text-sm" style={{ color: "var(--foreground)" }}>Preview</h2>
          <BrandPreviewCard
            colors={colors}
            headingFamily={headingFont.family}
            bodyFamily={bodyFont.family}
            logoUrl={logoAssets.find((a) => a.id === primaryLogoAssetId)?.url ?? logoAssets[0]?.url}
          />
          <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
            How your brand applies to portal chrome and template text. Save to apply everywhere.
          </p>
        </section>
      </div>
    </div>
  );
}

interface BrandPreviewCardProps {
  colors: BrandColor[];
  headingFamily: string;
  bodyFamily: string;
  logoUrl?: string;
}

function BrandPreviewCard({ colors, headingFamily, bodyFamily, logoUrl }: BrandPreviewCardProps) {
  const hex = (key: string, fallback: string) => colors.find((c) => c.key === key)?.hex ?? fallback;
  return (
    <div className="rounded-2xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
      <div className="px-5 py-4 flex items-center gap-3" style={{ background: hex("primary", "#2F3B4C") }}>
        {logoUrl && <img src={logoUrl} alt="" className="h-6 w-auto" />}
        <span className="text-white font-extrabold uppercase text-sm" style={{ fontFamily: `"${headingFamily}", sans-serif` }}>
          Sample Header
        </span>
      </div>
      <div className="p-5" style={{ background: hex("background", "#F6F7F9") }}>
        <p className="font-extrabold text-lg mb-1" style={{ color: hex("text", "#1A1F26"), fontFamily: `"${headingFamily}", sans-serif` }}>
          Congratulations, Jordan!
        </p>
        <p className="text-sm mb-3" style={{ color: hex("text", "#1A1F26"), fontFamily: `"${bodyFamily}", sans-serif` }}>
          Five incredible years — thank you for everything you do.
        </p>
        <span
          className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md"
          style={{ background: hex("accent", "#C9A227"), color: "#fff" }}
        >
          Accent chip
        </span>
      </div>
    </div>
  );
}
