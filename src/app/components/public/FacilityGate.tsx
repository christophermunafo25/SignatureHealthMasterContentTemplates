import React from "react";
import type { PublicFacility } from "@/lib/publicClient";
import { FacilityCombobox } from "../FacilityCombobox";
import { AdminSignInLink } from "./PublicApp";

/** First thing behind the shared link when no facility is stored for this
 * token: pick your facility before anything else. Mobile-first — a
 * full-height sheet with the search pinned to the top and the keyboard
 * raised on open. */
export function FacilityGate({
  companyName,
  facilities,
  onSelect,
  adminLink,
}: {
  companyName: string;
  facilities: PublicFacility[];
  onSelect(facility: PublicFacility): void;
  /** Root-URL mode: an admin landing here needs a way into the real app. */
  adminLink?: boolean;
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--linen)" }}>
      <div className="w-full max-w-lg mx-auto px-4 pt-8 sm:pt-16 pb-6 flex-1 flex flex-col">
        <p className="sp-eyebrow mb-2">{companyName}</p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontSize: 20,
            color: "var(--ink)",
            marginBottom: 6,
          }}
        >
          Which facility are you with?
        </h1>
        <p style={{ fontSize: 13, color: "var(--fg-3)", marginBottom: 16 }}>
          Your submissions are labeled with your facility so the social team
          knows where they came from.
        </p>
        <FacilityCombobox
          facilities={facilities}
          onSelect={onSelect}
          autoFocus
          emptyHint={
            <span>
              No facility matches that search. Don't see yours? Contact the
              Signature marketing team and they'll add it.
            </span>
          }
        />
        {adminLink && (
          <div className="text-center pt-6">
            <AdminSignInLink />
          </div>
        )}
      </div>
    </div>
  );
}
