import React, { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { HALL_OF_FAME_TEMPLATES, HOF_LAYOUTS, HOF_PHOTO_KEY, type HallOfFameTemplate } from "@/lib/hallOfFame";
import { fitTemplate } from "@/lib/hallOfFameFit";
import type { LibrarySection } from "@/lib/templateLibrary";
import { LibrarySections } from "../TemplateLibrary";
import { TemplateThumbnailMat } from "../TemplateThumbnail";
import { SchemaRenderer } from "../SchemaRenderer";
import { SkeletonBlock } from "./HallOfFameSkeleton";
import { useAssetsReady, useMeasurers } from "./useHallOfFameAssets";

/** One section per layout, each holding the three styles in library order. */
const SECTIONS: LibrarySection<HallOfFameTemplate>[] = HOF_LAYOUTS.map((layout) => ({
  key: `layout:${layout.key}`,
  title: layout.title,
  templates: HALL_OF_FAME_TEMPLATES.filter((t) => t.schema.category === layout.title),
}));

/** The Hall of Fame template library, drawn with the facility portal's own
 * grid and cards (PublicPortal). Thumbnails are live renders, fitted the same
 * way as the fill page, with each template's photo placeholder. */
export function HallOfFameLibrary({ onOpen }: { onOpen(template: HallOfFameTemplate): void }) {
  const ready = useAssetsReady(HALL_OF_FAME_TEMPLATES);
  const measurers = useMeasurers(ready);
  const thumbnails = useMemo(
    () => new Map(HALL_OF_FAME_TEMPLATES.map((t) => [t.id, fitTemplate(t, {}, measurers)])),
    [measurers],
  );

  return (
    <>
      {/* Clear of the header bar: the portal front page's 55px from sm up
          (PublicChooser), a little less on phones. */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-11 sm:pt-[55px] pb-2">
        {/* Light-on-navy header treatment: the page sits on the brand wash.
            Two lines on most screens; text-balance keeps them even. */}
        <h1
          className="text-balance"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "clamp(20px, 3vw, 34px)",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            color: "#ffffff",
            marginBottom: 8,
          }}
        >
          Create your Hall of Fame submission graphic for us to post on social media
        </h1>
        <p style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.85)", fontSize: 16, maxWidth: 460, marginBottom: 18 }}>
          Pick a template, add the winner&rsquo;s photo and name, then download the graphic and send it with your
          Hall of Fame submission.
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
        <LibrarySections
          sections={SECTIONS}
          tone="onDark"
          renderCard={(t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onOpen(t)}
              aria-label={`${t.schema.name}, ${t.schema.category}`}
              className="group text-left overflow-hidden transition-all flex flex-col"
              style={{
                background: "var(--lift)",
                border: "1px solid var(--hairline)",
                borderRadius: "var(--radius-card-sm)",
                boxShadow: "var(--shadow-e1)",
              }}
            >
              <div className="w-full" style={{ padding: 8 }}>
                <TemplateThumbnailMat template={t.schema}>
                  {ready ? (
                    <div className="w-full h-full pointer-events-none">
                      <SchemaRenderer
                        schema={thumbnails.get(t.id) ?? t.schema}
                        values={{ [HOF_PHOTO_KEY]: t.photoPlaceholder }}
                        brandKit={null}
                        instrument={false}
                      />
                    </div>
                  ) : (
                    <SkeletonBlock style={{ width: "100%", height: "100%", background: "#e1e5ea", borderRadius: 0 }} />
                  )}
                </TemplateThumbnailMat>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="sp-eyebrow mb-1">{t.schema.category}</p>
                    <h3
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: 17,
                        letterSpacing: "-0.01em",
                        color: "var(--ink)",
                      }}
                    >
                      {t.schema.name}
                    </h3>
                  </div>
                  <span
                    className="flex items-center justify-center flex-shrink-0 rounded-full transition-transform group-hover:translate-x-0.5"
                    style={{ width: 30, height: 30, background: "var(--peach)" }}
                  >
                    <ArrowRight style={{ width: 14, height: 14, color: "var(--ink)" }} />
                  </span>
                </div>
              </div>
            </button>
          )}
        />
      </div>
    </>
  );
}
