import { defineConfig } from "vitest/config";
import path from "node:path";

/** Unit tests only — the ported builder logic (field ops, layout, text
 *  sizing, save-error classification) is pure and needs no DOM. The `@`
 *  alias mirrors tsconfig so test files import exactly as app code does.
 *
 *  Vitest prefers this file over vite.config.ts, so the app config's Vite
 *  plugins do not apply here. That is deliberate — tests must not depend on
 *  the React or Tailwind pipeline — but it does mean the `figma:asset/`
 *  resolver is absent, so nothing under test may import a Figma asset.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "supabase/functions/**/*.test.ts",
    ],
  },
});
