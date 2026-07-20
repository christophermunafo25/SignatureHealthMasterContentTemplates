import React, { useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";

/** Admin CRUD for locations (branches/facilities/offices) — the generic,
 * per-tenant replacement for the hardcoded Signature facility list. Location
 * template fields render the selected location's logo. */
export function LocationsAdmin() {
  const { company } = useAuth();
  const { locations, refresh } = useBrand();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!company || !newName.trim()) return;
    setBusy(true);
    try {
      await stores.locations.create(company.id, { name: newName.trim() });
      setNewName("");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="font-extrabold uppercase text-xl mb-1" style={{ color: "var(--foreground)" }}>Locations</h1>
      <p className="text-sm mb-8" style={{ color: "var(--muted-foreground)" }}>
        Branches or facilities your templates can reference. Each can carry its own logo for
        location fields.
      </p>

      <div className="flex gap-2 mb-6">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void add()}
          placeholder="Location name"
          className="flex-1 rounded-xl border px-4 py-3 text-sm outline-none"
          style={{ borderColor: "var(--border)", background: "white", color: "var(--foreground)" }}
        />
        <button
          onClick={() => void add()}
          disabled={busy || !newName.trim()}
          className="flex items-center gap-2 font-bold uppercase text-xs tracking-wider px-5 rounded-xl disabled:opacity-50"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      <div className="space-y-2">
        {locations.length === 0 && (
          <p className="text-center py-14 text-sm rounded-2xl border-2 border-dashed" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
            No locations yet — they're optional.
          </p>
        )}
        {locations.map((l) => (
          <div
            key={l.id}
            className="flex items-center gap-4 bg-white rounded-2xl border px-5 py-3.5"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="w-12 h-12 rounded-lg border flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{ borderColor: "var(--border)" }}
            >
              {l.logoUrl ? (
                <img src={l.logoUrl} alt="" className="max-w-full max-h-full object-contain" />
              ) : (
                <span className="text-[9px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>No logo</span>
              )}
            </div>
            <span className="flex-1 text-sm font-semibold" style={{ color: "var(--foreground)" }}>{l.name}</span>
            <label className="cursor-pointer" title="Upload logo">
              <Upload className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void stores.locations.update(l.id, { logoFile: f }).then(refresh);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              onClick={() => {
                if (window.confirm(`Remove location "${l.name}"?`)) {
                  void stores.locations.remove(l.id).then(refresh);
                }
              }}
              aria-label={`Remove ${l.name}`}
            >
              <Trash2 className="w-4 h-4" style={{ color: "var(--destructive)" }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
