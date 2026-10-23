import React, { useEffect } from "react";
import { HOF_LEGAL_LINKS, hallOfFameTemplate } from "@/lib/hallOfFame";
import { pathFor, useRouter } from "../../router";
import { PublicShell } from "../public/PublicApp";
import { HallOfFameFill } from "./HallOfFameFill";
import { HallOfFameLibrary } from "./HallOfFameLibrary";
import "./hallOfFame.css";

/** Standalone Hall of Fame graphics (/hall-of-fame-submission and
 * /hall-of-fame-submission/:id).
 * The facility portal's chrome and components, none of its data: anonymous
 * and fully client-side, with no Supabase calls, no tokens, no usage events,
 * and no submission. Pick a template, add the photo and words, download the
 * PNG. An unknown template id shows the library. */
export default function HallOfFameApp() {
  const { route, navigate } = useRouter();
  const template = route.name === "hallOfFameTemplate" ? hallOfFameTemplate(route.templateId) : undefined;

  useEffect(() => {
    const previous = document.title;
    document.title = "Hall of Fame submission graphics";
    return () => {
      document.title = previous;
    };
  }, []);

  // Links to the first path (/hall-of-fame) still open these pages. Show the
  // current address, so a link copied from the address bar is the new one.
  useEffect(() => {
    const path = pathFor(route);
    if (window.location.pathname !== path) {
      window.history.replaceState(null, "", path + window.location.search + window.location.hash);
    }
  }, [route]);

  // Each view starts at the top: the second row of cards sits below the fold.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [template?.id]);

  return (
    <PublicShell data={null}>
      <div className="hof-scope">
        {template ? (
          <HallOfFameFill key={template.id} template={template} onBack={() => navigate({ name: "hallOfFame" })} />
        ) : (
          <HallOfFameLibrary onOpen={(t) => navigate({ name: "hallOfFameTemplate", templateId: t.id })} />
        )}
        {HOF_LEGAL_LINKS.length > 0 && (
          <footer className="max-w-6xl mx-auto px-5 sm:px-8 pb-10">
            <nav aria-label="Legal" className="flex flex-wrap gap-5" style={{ fontSize: 13 }}>
              {HOF_LEGAL_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "rgba(255,255,255,0.8)", textDecoration: "underline", textUnderlineOffset: 3 }}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </footer>
        )}
      </div>
    </PublicShell>
  );
}
