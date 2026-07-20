import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X, Building2 } from "lucide-react";

export const FACILITIES = [
  "Bluegrass Care & Rehabilitation Center",
  "Clinton County Care & Rehabilitation Center",
  "Danville Centre for Health & Rehabilitation",
  "Fountain Circle Care & Rehabilitation Center",
  "Harrodsburg Health & Rehabilitation Center",
  "Hermitage Care & Rehabilitation Center",
  "Lee County Care & Rehabilitation Center",
  "Liberty Care & Rehabilitation Center",
  "Mayfair Manor",
  "Monroe County Rehab & Wellness Center",
  "Morgantown Care & Rehabilitation Center",
  "Mountain City Care & Rehabilitation Center",
  "Oakview Nursing & Rehabilitation Center",
  "Pickett Care & Rehabilitation Center",
  "Prestonsburg Health Care Center",
  "Princeton Assisted Living and Transitional Care",
  "Riverside Care & Rehabilitation Center",
  "Riverview Health Care Center",
  "Rockcastle Health & Rehabilitation Center",
  "Signature HealthCARE at Colonial",
  "Signature HealthCARE at Heritage Hall",
  "Signature HealthCARE at Hillcrest",
  "Signature HealthCARE at Jackson Manor",
  "Signature HealthCARE at Jefferson Manor",
  "Signature HealthCARE at Jefferson Place",
  "Signature HealthCARE at Parkwood",
  "Signature HealthCARE at Rockford",
  "Signature HealthCARE at Summerfield",
  "Signature HealthCARE at Summit Manor",
  "Signature HealthCARE of Bowling Green",
  "Signature HealthCARE of Bremen",
  "Signature HealthCARE of Carrollton",
  "Signature HealthCARE of Chapel Hill",
  "Signature HealthCARE of Clarksville",
  "Signature HealthCARE of Cleveland",
  "Signature HealthCARE of East Louisville",
  "Signature HealthCARE of Elizabethton",
  "Signature HealthCARE of Elizabethtown",
  "Signature HealthCARE of Erin",
  "Signature HealthCARE of Fayette County",
  "Signature HealthCARE of Fentress County",
  "Signature HealthCARE of Galion",
  "Signature HealthCARE of Georgetown",
  "Signature HealthCARE of Glasgow",
  "Signature HealthCARE of Greeneville",
  "Signature HealthCARE of Hart County",
  "Signature HealthCARE of Hartford",
  "Signature HealthCARE of Kinston",
  "Signature HealthCARE of McCreary County",
  "Signature HealthCARE of Memphis",
  "Signature HealthCARE of Monteagle",
  "Signature HealthCARE of Muncie",
  "Signature HealthCARE of Norfolk",
  "Signature HealthCARE of North Hardin",
  "Signature HealthCARE of Portland",
  "Signature HealthCARE of Primacy",
  "Signature HealthCARE of Putnam",
  "Signature HealthCARE of Ridgely",
  "Signature HealthCARE of Roanoke Rapids",
  "Signature HealthCARE of Rockwood",
  "Signature HealthCARE of Rogersville",
  "Signature HealthCARE of South Louisville",
  "Signature HealthCARE of South Pittsburg",
  "Signature HealthCARE of Spencer County",
  "Signature HealthCARE of Terre Haute",
  "Spring City Care & Rehab",
  "Standing Stone Care & Rehab",
  "Sunrise Manor",
  "Westmoreland Care & Rehabilitation Center",
];

interface FacilitySelectorProps {
  value: string;
  onChange: (facility: string) => void;
}

export function FacilitySelector({ value, onChange }: FacilitySelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? FACILITIES.filter((f) => f.toLowerCase().includes(query.toLowerCase()))
    : FACILITIES;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleSelect = (facility: string) => {
    onChange(facility);
    setOpen(false);
    setQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setQuery("");
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 text-left transition-all"
        style={{
          fontFamily: "Montserrat, sans-serif",
          fontSize: 14,
          background: "#F5F7FA",
          border: `1.5px solid ${open ? "#0067B1" : "#E3E8EE"}`,
          borderRadius: 12,
          padding: "11px 14px",
          boxShadow: open ? "0 0 0 3px rgba(0,103,177,0.12)" : "none",
          color: value ? "#17202A" : "#9AA7B4",
          cursor: "pointer",
        }}
      >
        <Building2
          style={{ width: 16, height: 16, color: value ? "#0067B1" : "#9AA7B4", flexShrink: 0 }}
        />
        <span className="flex-1 truncate">
          {value || "Select your facility…"}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {value && (
            <span
              onClick={handleClear}
              className="flex items-center justify-center rounded-full transition-colors"
              style={{ width: 20, height: 20, background: "#DCEBF7", cursor: "pointer" }}
            >
              <X style={{ width: 11, height: 11, color: "#0067B1" }} />
            </span>
          )}
          <ChevronDown
            style={{
              width: 16,
              height: 16,
              color: "#9AA7B4",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
            }}
          />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 right-0 rounded-2xl overflow-hidden"
          style={{
            top: "calc(100% + 6px)",
            zIndex: 100,
            background: "white",
            border: "1.5px solid #E3E8EE",
            boxShadow: "0 8px 32px rgba(6,38,63,0.14)",
          }}
        >
          {/* Search */}
          <div
            className="flex items-center gap-2 px-4"
            style={{ borderBottom: "1px solid #E3E8EE", padding: "10px 14px" }}
          >
            <Search style={{ width: 14, height: 14, color: "#9AA7B4", flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search facilities…"
              style={{
                flex: 1,
                fontFamily: "Montserrat, sans-serif",
                fontSize: 13,
                color: "#17202A",
                background: "transparent",
                border: "none",
                outline: "none",
              }}
            />
            {query && (
              <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                <X style={{ width: 13, height: 13, color: "#9AA7B4" }} />
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <p style={{ fontFamily: "Montserrat, sans-serif", color: "#9AA7B4", fontSize: 13, padding: "14px 16px", textAlign: "center" }}>
                No facilities match &ldquo;{query}&rdquo;
              </p>
            ) : (
              filtered.map((facility) => {
                const selected = facility === value;
                return (
                  <button
                    key={facility}
                    type="button"
                    onClick={() => handleSelect(facility)}
                    className="w-full text-left flex items-center gap-3 transition-colors"
                    style={{
                      padding: "10px 16px",
                      fontFamily: "Montserrat, sans-serif",
                      fontSize: 13,
                      color: selected ? "#0067B1" : "#17202A",
                      background: selected ? "#DCEBF7" : "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      if (!selected) (e.currentTarget as HTMLElement).style.background = "#F5F7FA";
                    }}
                    onMouseLeave={(e) => {
                      if (!selected) (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <span className="flex-1">{facility}</span>
                    {selected && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2.5 7L5.5 10L11.5 4" stroke="#0067B1" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
