import React, { useState, useMemo } from "react";
import { Search, ArrowRight } from "lucide-react";

import sosThumbnail from "../../imports/image-1.png";
import spotlightThumbnail from "../../imports/image-2.png";
import meetTheTeamThumbnail from "../../imports/image-3.png";
import newHireWelcomeThumbnail from "../../imports/image-5.png";
import workAnniversaryThumbnail from "../../imports/image-6.png";
import headerLogo from "../../imports/image-4.png";

function SoSThumbnail() {
  return <img src={sosThumbnail} alt="Stories of Service template" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />;
}

function SpotlightThumbnail() {
  return <img src={spotlightThumbnail} alt="Employee Spotlight template" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />;
}

function MeetTheTeamThumbnail() {
  return <img src={meetTheTeamThumbnail} alt="Meet the Care Team template" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />;
}

function NewHireWelcomeThumbnail() {
  return <img src={newHireWelcomeThumbnail} alt="New Hire Welcome template" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />;
}

function WorkAnniversaryThumbnail() {
  return <img src={workAnniversaryThumbnail} alt="Work Anniversary template" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />;
}

// ---------- Template registry ----------

const TEMPLATES = [
  {
    id: "sos",
    name: "Stories of Service",
    description: "Celebrate a team member with their headshot, name, and three milestone facts on a bold Facebook square post.",
    tags: ["Recognition", "Social", "Facebook", "Anniversary", "Milestones"],
    fields: ["Headshot", "Name", "3 Facts"],
    accent: "#F6AB60",
    category: "Recognition",
    Thumbnail: SoSThumbnail,
  },
  {
    id: "spotlight",
    name: "Employee Spotlight",
    description: "Feature an employee with a bold quote and polaroid-style headshot on a bright blue gradient background.",
    tags: ["Spotlight", "Recognition", "Social", "Facebook", "Quote"],
    fields: ["Headshot", "Name", "Quote"],
    accent: "#FF9E19",
    category: "Recognition",
    Thumbnail: SpotlightThumbnail,
  },
  {
    id: "meettheteam",
    name: "Meet the Care Team",
    description: "Introduce a care team with a photo, team name, and three highlights on a bold navy gradient background.",
    tags: ["Team", "Recognition", "Social", "Facebook", "Introduction"],
    fields: ["Team Photo", "Team Name", "3 Facts"],
    accent: "#f86464",
    category: "Team",
    Thumbnail: MeetTheTeamThumbnail,
  },
  {
    id: "newhirewelcome",
    name: "New Hire Welcome",
    description: "Welcome a new team member with their headshot, name, and job title on a warm navy background.",
    tags: ["New Hire", "Recognition", "Social", "Facebook", "Welcome"],
    fields: ["Headshot", "Name", "Job Title"],
    accent: "#f1b367",
    category: "Recognition",
    Thumbnail: NewHireWelcomeThumbnail,
  },
  {
    id: "workanniversary",
    name: "Work Anniversary",
    description: "Celebrate a work anniversary with the employee's years of service, name, and headshot on a bold amber background.",
    tags: ["Anniversary", "Recognition", "Social", "Facebook", "Milestone"],
    fields: ["Headshot", "Years", "Name", "Job Title"],
    accent: "#f1b367",
    category: "Recognition",
    Thumbnail: WorkAnniversaryThumbnail,
  },
];

// ---------- Landing page ----------

interface LandingPageProps {
  onSelect: (id: string) => void;
}

export function LandingPage({ onSelect }: LandingPageProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return TEMPLATES;
    const q = query.toLowerCase();
    return TEMPLATES.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [query]);

  return (
    <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
      {/* Header */}
      <header style={{ background: "#06263F" }}>
        <div className="max-w-7xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <img src={headerLogo} alt="Signature HealthCARE" style={{ height: 36, width: "auto", display: "block", marginBottom: 4 }} />
            <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "white", fontSize: 15, letterSpacing: "0.04em", textTransform: "uppercase", lineHeight: 1 }}>
              Graphic Generator
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "rgba(246,171,96,0.12)", border: "1px solid rgba(246,171,96,0.3)" }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#F6AB60" }} />
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#F6AB60", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>
              Template Library
            </span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(160deg, #06263F 0%, #0067B1 100%)" }}>
        <div className="absolute rounded-full" style={{ width: 320, height: 320, background: "rgba(246,171,96,0.07)", top: -80, right: -60, filter: "blur(40px)" }} />
        <div className="absolute rounded-full" style={{ width: 200, height: 200, background: "rgba(220,235,247,0.08)", bottom: -60, left: 80, filter: "blur(30px)" }} />

        <div className="relative max-w-7xl mx-auto px-4 py-14">
          <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#F6AB60", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 10 }}>
            Social Media Assets
          </p>
          <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "white", fontSize: "clamp(28px, 5vw, 44px)", textTransform: "uppercase", letterSpacing: "0.02em", lineHeight: 1.1, marginBottom: 12 }}>
            Choose a Template
          </h1>
          <p style={{ fontFamily: "Montserrat, sans-serif", color: "rgba(220,235,247,0.75)", fontSize: 15, lineHeight: 1.6, marginBottom: 32, maxWidth: 440 }}>
            Select a graphic template, fill in the details, and download a ready-to-post social image.
          </p>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute" style={{ left: 16, top: "50%", transform: "translateY(-50%)", color: "rgba(220,235,247,0.5)", width: 18, height: 18 }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates…"
              style={{
                width: "100%",
                fontFamily: "Montserrat, sans-serif",
                fontSize: 14,
                color: "white",
                background: "rgba(255,255,255,0.1)",
                border: "1.5px solid rgba(255,255,255,0.15)",
                borderRadius: 12,
                padding: "12px 16px 12px 46px",
                outline: "none",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(246,171,96,0.6)"; e.currentTarget.style.background = "rgba(255,255,255,0.14)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
            />
          </div>
        </div>
      </div>

      {/* Template Grid */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#9AA7B4", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              No templates match &ldquo;{query}&rdquo;
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#06263F", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.16em" }}>
                {filtered.length} Template{filtered.length !== 1 ? "s" : ""}
              </p>
              <p style={{ fontFamily: "Montserrat, sans-serif", color: "#9AA7B4", fontSize: 12 }}>
                Click a template to get started
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((t) => {
                const Thumbnail = t.Thumbnail;
                return (
                  <button
                    key={t.id}
                    onClick={() => onSelect(t.id)}
                    className="group text-left rounded-2xl overflow-hidden transition-all flex flex-col"
                    style={{ background: "white", border: "1.5px solid #E3E8EE", boxShadow: "0 2px 12px rgba(6,38,63,0.06)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(0,103,177,0.16)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(6,38,63,0.06)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                  >
                    {/* Template thumbnail */}
                    <div className="w-full overflow-hidden" style={{ aspectRatio: "1 / 1", borderRadius: "10px 10px 0 0" }}>
                      <Thumbnail />
                    </div>

                    {/* Card body */}
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#0067B1", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 3 }}>
                            {t.category}
                          </p>
                          <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#06263F", fontSize: 18, textTransform: "uppercase", letterSpacing: "0.02em", lineHeight: 1.1 }}>
                            {t.name}
                          </h2>
                        </div>
                        <div
                          className="flex items-center justify-center flex-shrink-0 rounded-full transition-transform group-hover:translate-x-0.5"
                          style={{ width: 36, height: 36, background: "#F86464", marginTop: 2 }}
                        >
                          <ArrowRight style={{ width: 16, height: 16, color: "#06263F" }} />
                        </div>
                      </div>

                      <p style={{ fontFamily: "Montserrat, sans-serif", color: "#5B6B7A", fontSize: 13, lineHeight: 1.55, marginBottom: 14 }}>
                        {t.description}
                      </p>

                      {/* Fields needed */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {t.fields.map((field) => (
                          <span
                            key={field}
                            style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#06263F", background: "#DCEBF7", padding: "3px 8px", borderRadius: 6 }}
                          >
                            {field}
                          </span>
                        ))}
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1">
                        {t.tags.map((tag) => (
                          <span
                            key={tag}
                            style={{ fontFamily: "Montserrat, sans-serif", fontSize: 11, color: "#9AA7B4", background: "#F5F7FA", padding: "2px 7px", borderRadius: 5, border: "1px solid #E3E8EE" }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t" style={{ borderColor: "#E3E8EE", background: "white" }}>
        <div className="max-w-7xl mx-auto px-4 py-5 flex items-center justify-between">
          <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#9AA7B4", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em" }}>
            Signature HealthCARE &mdash; Internal Use Only
          </p>
          <p style={{ fontFamily: "Montserrat, sans-serif", color: "#9AA7B4", fontSize: 11 }}>
            {TEMPLATES.length} templates available
          </p>
        </div>
      </footer>
    </div>
  );
}
