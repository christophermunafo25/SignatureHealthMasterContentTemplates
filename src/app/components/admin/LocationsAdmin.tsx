import React, { useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";

/** Admin CRUD for locations (branches/facilities/offices). Location template
 * fields render the selected location's logo. */
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
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="sp-page-title">Locations</h1>
      <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4, marginBottom: 24 }}>
        Branches or facilities your templates can reference. Each can carry its own logo for location fields.
      </p>

      <div className="flex gap-2 mb-5">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void add()}
          placeholder="Location name"
          className="sp-input flex-1"
        />
        <button onClick={() => void add()} disabled={busy || !newName.trim()} className="sp-btn sp-btn-primary">
          <Plus style={{ width: 13, height: 13 }} />
          Add
        </button>
      </div>

      <div className="space-y-2">
        {locations.length === 0 && (
          <p
            className="text-center py-14"
            style={{ fontSize: 13, color: "var(--fg-3)", border: "1.5px dashed var(--hairline-strong)", borderRadius: "var(--radius-card-sm)" }}
          >
            No locations yet — they're optional.
          </p>
        )}
        {locations.map((l) => (
          <div key={l.id} className="sp-card flex items-center gap-4 px-4 py-3">
            <div
              className="flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{ width: 44, height: 44, borderRadius: "var(--radius-icon)", border: "1px solid var(--hairline)", background: "var(--paper)" }}
            >
              {l.logoUrl ? (
                <img src={l.logoUrl} alt="" className="max-w-full max-h-full object-contain" />
              ) : (
                <span className="sp-eyebrow" style={{ fontSize: 8 }}>No logo</span>
              )}
            </div>
            <span className="flex-1" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{l.name}</span>
            <label className="cursor-pointer" title="Upload logo">
              <Upload style={{ width: 15, height: 15, color: "var(--fg-2)" }} />
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
              <Trash2 style={{ width: 15, height: 15, color: "var(--danger)" }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
