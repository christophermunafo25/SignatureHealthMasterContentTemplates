// Data-layer contracts. Components import ONLY these interfaces (via the
// factory in ./index.ts) — nothing outside src/lib touches a backend client.

import type {
  BrandAsset,
  BrandKit,
  CanvasPreset,
  Company,
  DesignImportResult,
  Location,
  NewTemplateInput,
  TemplateSchema,
  TemplateStatus,
  UsageAction,
  UsageSummary,
} from "../types";

export interface CompanyStore {
  list(): Promise<Company[]>; // dev switcher needs the full list
  get(id: string): Promise<Company | null>;
  create(input: { name: string; slug: string }): Promise<Company>;
  hasAnyCompany(): Promise<boolean>; // first-run / onboarding routing
  listCanvasPresets(): Promise<CanvasPreset[]>;
}

export interface TemplateStore {
  listPublished(companyId: string): Promise<TemplateSchema[]>; // member portal
  listAll(companyId: string): Promise<TemplateSchema[]>; // admin (drafts too)
  get(id: string): Promise<TemplateSchema | null>;
  create(input: NewTemplateInput): Promise<TemplateSchema>;
  /** Fields are replaced wholesale (delete + insert) on each builder save. */
  update(id: string, patch: Partial<NewTemplateInput>): Promise<TemplateSchema>;
  setStatus(id: string, status: TemplateStatus): Promise<void>;
  delete(id: string): Promise<void>;
  uploadBackground(companyId: string, file: Blob, name: string): Promise<string>; // → public URL
}

export interface BrandKitStore {
  getActive(companyId: string): Promise<BrandKit | null>; // null → neutral default theme
  upsert(companyId: string, kit: Omit<BrandKit, "id" | "companyId">): Promise<BrandKit>;
}

export interface BrandAssetStore {
  list(companyId: string, kind?: BrandAsset["kind"]): Promise<BrandAsset[]>;
  upload(
    companyId: string,
    kind: BrandAsset["kind"],
    file: File,
    metadata?: BrandAsset["metadata"],
  ): Promise<BrandAsset>;
  remove(id: string): Promise<void>;
}

export interface LocationStore {
  list(companyId: string): Promise<Location[]>;
  create(companyId: string, input: { name: string; logoFile?: File }): Promise<Location>;
  update(id: string, patch: { name?: string; logoFile?: File }): Promise<Location>;
  remove(id: string): Promise<void>;
}

export interface UsageStore {
  /** Fire-and-forget from SchemaRenderer; failures must never break the UI. */
  record(companyId: string, templateId: string, action: UsageAction, userId?: string): Promise<void>;
  getUsageSummary(companyId: string): Promise<UsageSummary>;
}

export interface DesignImportProvider {
  readonly provider: "figma";
  isConfigured(): boolean; // backend reachable at all (Edge Functions deployed)
  isConnected(companyId: string): Promise<boolean>;
  connect(companyId: string, credential: { kind: "oauth-code" | "pat"; value: string }): Promise<void>;
  importFromUrl(companyId: string, url: string): Promise<DesignImportResult>;
}

/** Swappable hook for the Template Builder's "Suggest fields" button.
 * v1 ships a stub; a vision-model implementation can drop in later. */
export type DetectFields = (imageUrl: string) => Promise<import("../types").TemplateField[]>;

export interface Stores {
  companies: CompanyStore;
  templates: TemplateStore;
  brandKits: BrandKitStore;
  brandAssets: BrandAssetStore;
  locations: LocationStore;
  usage: UsageStore;
  designImport: DesignImportProvider;
  /** "supabase" or "local" — surfaced in the dev switcher so it's obvious
   * which backend is active. */
  backend: "supabase" | "local";
}
