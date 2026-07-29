import React, { useMemo, useState } from "react";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "./ui/command";
import type { PublicFacility } from "@/lib/publicClient";

/** Search: case-insensitive substring on ANY token of short_name + name
 * together — 46 of 69 names begin with "Signature HealthCARE", so leading-
 * token matching would make "Sig" match two thirds of the roster while the
 * distinguishing word sits at the end. Whitespace-separated terms are
 * ANDed, so "south lou" narrows correctly. */
export function facilityMatches(f: PublicFacility, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${f.shortName} ${f.name} ${f.state ?? ""}`.toLowerCase();
  return q.split(/\s+/).every((term) => haystack.includes(term));
}

/** Bold the matched substrings of the first search term inside a label. */
function Highlight({ text, query }: { text: string; query: string }) {
  const term = query.trim().toLowerCase().split(/\s+/)[0] ?? "";
  if (!term) return <>{text}</>;
  const i = text.toLowerCase().indexOf(term);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <b style={{ fontWeight: 700 }}>{text.slice(i, i + term.length)}</b>
      {text.slice(i + term.length)}
    </>
  );
}

export interface FacilityComboboxProps {
  facilities: PublicFacility[];
  onSelect(facility: PublicFacility): void;
  /** Shown when a search matches nothing — a missing facility during
   * rollout must not be a dead end. */
  emptyHint?: React.ReactNode;
  autoFocus?: boolean;
  placeholder?: string;
}

/** Searchable facility picker on cmdk. NO default selection — a wrong
 * facility silently attached to every submission is worse than an extra
 * tap. Reused by the facility gate and the dashboard's facility filter. */
export function FacilityCombobox({
  facilities,
  onSelect,
  emptyHint,
  autoFocus,
  placeholder = "Search your facility…",
}: FacilityComboboxProps) {
  const [query, setQuery] = useState("");
  const shown = useMemo(
    () => facilities.filter((f) => facilityMatches(f, query)),
    [facilities, query],
  );

  return (
    <Command shouldFilter={false} className="rounded-xl" style={{ border: "1px solid var(--hairline)" }}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label="Search facilities"
      />
      <CommandList style={{ maxHeight: "min(52vh, 420px)" }}>
        <CommandEmpty>
          {emptyHint ?? "No facility matches that search."}
        </CommandEmpty>
        {shown.map((f) => (
          <CommandItem
            key={f.id}
            value={f.id}
            onSelect={() => onSelect(f)}
            // Focus highlight must keep navy text readable — quiet grey, not
            // the navy accent fill the shadcn default uses.
            className="flex flex-col items-start gap-0.5 py-2.5 data-[selected=true]:!bg-[var(--paper)]"
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
              <Highlight text={f.shortName} query={query} />
              {f.state && (
                <span style={{ fontWeight: 400, fontSize: 12, color: "var(--fg-4)" }}> · {f.state}</span>
              )}
            </span>
            {f.name !== f.shortName && (
              <span style={{ fontSize: 12, color: "var(--fg-3)" }}>
                <Highlight text={f.name} query={query} />
              </span>
            )}
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  );
}
