import { useEffect, useMemo, useState } from "react";
import { HOF_FONT_STYLESHEET, type HallOfFameTemplate } from "@/lib/hallOfFame";
import type { FitMeasurers, MeasureText } from "@/lib/hallOfFameFit";

/** Resolves once (whether it loads or fails): one link for the session. */
let stylesheet: Promise<void> | null = null;

function loadStylesheet(href: string): Promise<void> {
  stylesheet ??= new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.hofFonts = "";
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
  return stylesheet;
}

function decodeImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

/** Templates whose assets have resolved once this session: opening one from
 * the library, or going back to it, skips the skeleton. */
const readyIds = new Set<string>();

/** True once the two faces the graphics are set in, and these templates'
 * backgrounds and photo placeholders, are ready. Capped at 6s so a slow
 * network never strands the page on a skeleton. Text fitting re-measures
 * when this flips. */
export function useAssetsReady(templates: readonly HallOfFameTemplate[]): boolean {
  const [ready, setReady] = useState(() => templates.every((t) => readyIds.has(t.id)));
  const key = templates.map((t) => t.id).join(",");
  useEffect(() => {
    if (templates.every((t) => readyIds.has(t.id))) {
      setReady(true);
      return;
    }
    let alive = true;
    setReady(false);
    const fonts = loadStylesheet(HOF_FONT_STYLESHEET).then(() =>
      Promise.all([document.fonts.load('600 60px "Lora"'), document.fonts.load('500 30px "Montserrat"')]).catch(
        () => undefined,
      ),
    );
    const images = templates.flatMap((t) => [decodeImage(t.schema.backgroundUrl), decodeImage(t.photoPlaceholder)]);
    const cap = new Promise<void>((resolve) => setTimeout(resolve, 6000));
    void Promise.race([Promise.all([fonts, ...images]), cap]).then(() => {
      for (const t of templates) readyIds.add(t.id);
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
    // `key` stands in for `templates`, which callers may rebuild each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return ready;
}

/** Canvas-backed measurers in the exact faces the renderer paints with. A new
 * pair is minted whenever a font finishes loading (the two faces arriving
 * after the 6s cap, or a Latin Extended subset loading once someone types
 * "Ł"), so every fit re-measures with the real glyphs instead of the
 * fallback face. */
export function useMeasurers(fontsReady: boolean): FitMeasurers {
  const [fontLoads, setFontLoads] = useState(0);
  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts?.addEventListener) return;
    const bump = () => setFontLoads((n) => n + 1);
    fonts.addEventListener("loadingdone", bump);
    return () => fonts.removeEventListener("loadingdone", bump);
  }, []);
  return useMemo(() => {
    const ctx = document.createElement("canvas").getContext("2d");
    const make =
      (family: string, weight: number): MeasureText =>
      (text, size) => {
        if (!ctx) return text.length * size * 0.6;
        ctx.font = `${weight} ${size}px "${family}", sans-serif`;
        return ctx.measureText(text).width;
      };
    return { name: make("Lora", 600), highlight: make("Montserrat", 500) };
    // fontsReady and fontLoads are triggers, not inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsReady, fontLoads]);
}
