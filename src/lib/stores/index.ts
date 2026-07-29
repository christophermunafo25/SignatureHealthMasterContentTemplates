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
import { SupabaseFacilityLinkStore } from "./supabase/facilityLinkStore";
import { SupabaseSubmissionStore } from "./supabase/submissionStore";
import { FigmaImporter } from "./supabase/figmaImporter";
import {
  LocalBrandAssetStore,
  LocalBrandKitStore,
  LocalCompanyStore,
  LocalDesignImportProvider,
  LocalFacilityLinkStore,
  LocalPeopleStore,
  LocalSubmissionStore,
  LocalTemplateStore,
  LocalUsageStore,
} from "./local/localStores";

function createStores(): Stores {
  if (isSupabaseConfigured) {
    return {
      companies: new SupabaseCompanyStore(),
      templates: new SupabaseTemplateStore(),
      brandKits: new SupabaseBrandKitStore(),
      brandAssets: new SupabaseBrandAssetStore(),
      usage: new SupabaseUsageStore(),
      people: new SupabasePeopleStore(),
      facilityLinks: new SupabaseFacilityLinkStore(),
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
    facilityLinks: new LocalFacilityLinkStore(),
    submissions: new LocalSubmissionStore(),
    designImport: new LocalDesignImportProvider(),
    backend: "local",
  };
}

export const stores: Stores = createStores();

export type { Stores } from "./interfaces";
