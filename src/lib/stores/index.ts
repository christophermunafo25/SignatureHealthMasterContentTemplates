// Store factory. Components import `stores` from here and never touch a
// backend client directly. Backend selection:
//   - VITE_SUPABASE_URL set   → Supabase (Postgres + Storage + Edge Functions)
//   - unset                   → localStorage dev backend (zero setup)

import type { Stores } from "./interfaces";
import { isSupabaseConfigured } from "./supabase/client";
import { SupabaseCompanyStore } from "./supabase/companyStore";
import { SupabaseTemplateStore } from "./supabase/templateStore";
import { SupabaseBrandAssetStore, SupabaseBrandKitStore } from "./supabase/brandStore";
import { SupabaseUsageStore } from "./supabase/usageStore";
import { SupabasePeopleStore } from "./supabase/peopleStore";
import { SupabaseFacilityStore } from "./supabase/facilityStore";
import { SupabaseSubmissionStore } from "./supabase/submissionStore";
import { FigmaImporter } from "./supabase/figmaImporter";
import {
  LocalBrandAssetStore,
  LocalBrandKitStore,
  LocalCompanyStore,
  LocalDesignImportProvider,
  LocalFacilityStore,
  LocalPeopleStore,
  LocalSubmissionStore,
  LocalTemplateStore,
  LocalUsageStore,
} from "./local/localStores";

function createStores(): Stores {
  // A production bundle must NEVER fall back to the localStorage dev
  // backend: it would render an unauthenticated admin console on the
  // client's URL. (Guarded again at build time in vite.config.ts and at
  // mount time in App.tsx.)
  if (import.meta.env.PROD && !isSupabaseConfigured) {
    throw new Error(
      "Production build without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — refusing to start the dev backend.",
    );
  }
  if (isSupabaseConfigured) {
    return {
      companies: new SupabaseCompanyStore(),
      templates: new SupabaseTemplateStore(),
      brandKits: new SupabaseBrandKitStore(),
      brandAssets: new SupabaseBrandAssetStore(),
      usage: new SupabaseUsageStore(),
      people: new SupabasePeopleStore(),
      facilities: new SupabaseFacilityStore(),
      submissions: new SupabaseSubmissionStore(),
      designImport: new FigmaImporter(),
      backend: "supabase",
    };
  }
  return {
    companies: new LocalCompanyStore(),
    templates: new LocalTemplateStore(),
    brandKits: new LocalBrandKitStore(),
    brandAssets: new LocalBrandAssetStore(),
    usage: new LocalUsageStore(),
    people: new LocalPeopleStore(),
    facilities: new LocalFacilityStore(),
    submissions: new LocalSubmissionStore(),
    designImport: new LocalDesignImportProvider(),
    backend: "local",
  };
}

export const stores: Stores = createStores();

export type { Stores } from "./interfaces";
