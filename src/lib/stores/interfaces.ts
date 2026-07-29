// Data-layer contracts. Components import ONLY these interfaces (via the
// factory in ./index.ts) — nothing outside src/lib touches a backend client.

import type {
  BrandAsset,
  BrandKit,
  CanvasPreset,
  Company,
  DailyActivityPoint,
  DesignImportResult,
  Facility,
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
  /** Submission-notification recipients (Settings → Notifications). */
  setNotificationEmails(companyId: string, emails: string[]): Promise<void>;
  /** Rotate the shared portal token server-side (RPC); previous token
   * keeps working for the grace window. Returns the fresh token. */
  rotatePortalToken(companyId: string, graceDays?: number): Promise<string>;
  setPortalEnabled(companyId: string, enabled: boolean): Promise<void>;
  /** Opt the company's facility portal into the bare root URL (no token). */
  setPortalPublic(companyId: string, isPublic: boolean): Promise<void>;
}

export interface TemplateStore {
  listPublished(companyId: string): Promise<TemplateSchema[]>; // member portal
  listAll(companyId: string): Promise<TemplateSchema[]>; // admin (drafts too)
  get(id: string): Promise<TemplateSchema | null>;
  create(input: NewTemplateInput): Promise<TemplateSchema>;
  /** Fields are replaced wholesale (delete + insert) on each builder save. */
  update(id: string, patch: Partial<NewTemplateInput>): Promise<TemplateSchema>;
  setStatus(id: string, status: TemplateStatus): Promise<void>;
  /** Deep copy: new template row, new field rows, same fieldKeys so the
   *  captionTemplate stays valid. Always lands as a draft. */
  duplicate(id: string, name: string): Promise<TemplateSchema>;
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

export interface Member {
  userId: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  avatarUrl?: string;
  role: import("../types").Role;
}

/** Team management under real auth (invites go through the invite-member
 * Edge Function so the service role never reaches the client). */
export interface InviteResult {
  /** The address already had an account — membership was added to it. */
  existing: boolean;
  /** Link mode only: the one-time URL to hand the person directly. */
  actionLink: string | null;
}

export interface PeopleStore {
  list(companyId: string): Promise<Member[]>;
  /** `mode: "link"` mints the invite URL without sending mail — the auth
   * mailer is rate-limited, and onboarding a team shouldn't wait on it. */
  invite(
    companyId: string,
    email: string,
    role: import("../types").Role,
    mode?: "email" | "link",
  ): Promise<InviteResult>;
  setRole(companyId: string, userId: string, role: import("../types").Role): Promise<void>;
  remove(companyId: string, userId: string): Promise<void>;
}

/** The review queue. Admin-only: facility staff have no account and no
 * read path back into the queue — anonymous inserts happen through the
 * submit-content Edge Function via service role. */
export interface SubmissionStore {
  /** Filtering happens IN THE QUERY — 69 facilities submitting weekly
   * outgrow fetch-then-filter-in-JS within months. */
  list(
    companyId: string,
    filter?: {
      status?: import("../types").SubmissionStatus | "all";
      facilityId?: string;
      templateId?: string;
      from?: string;
      to?: string;
      search?: string;
    },
  ): Promise<import("../types").Submission[]>;
  /** The dashboard stat strip. */
  stats(companyId: string): Promise<{
    awaitingReview: number;
    approvedUnposted: number;
    posted30d: number;
    declined30d: number;
  }>;
  get(id: string): Promise<import("../types").Submission | null>;
  /** Sets reviewed_by/reviewed_at on the first edit or status change. */
  update(
    id: string,
    patch: Partial<
      Pick<import("../types").Submission, "values" | "caption" | "status" | "internalNote" | "declineReason">
    >,
  ): Promise<import("../types").Submission>;
  countNew(companyId: string): Promise<number>;
  remove(id: string): Promise<void>;
  /** Resolve a preview_path to a viewable URL (signed URL on Supabase; the
   * stored data URL on the dev backend). */
  previewUrl(path: string): Promise<string | null>;
}

/** The facility roster behind the shared portal link. Deactivate rather
 * than delete — submissions.facility_name is denormalized and history
 * stays readable. */
export interface FacilityStore {
  list(companyId: string): Promise<Facility[]>;
  create(companyId: string, input: { name: string; shortName: string }): Promise<Facility>;
  /** Onboarding dozens at once from a pasted list of legal names. */
  bulkCreate(companyId: string, rows: Array<{ name: string; shortName: string }>): Promise<Facility[]>;
  rename(id: string, patch: { name?: string; shortName?: string }): Promise<void>;
  setActive(id: string, active: boolean): Promise<void>;
}

export interface UsageStore {
  /** Fire-and-forget from SchemaRenderer; failures must never break the UI. */
  record(companyId: string, templateId: string, action: UsageAction, userId?: string): Promise<void>;
  getUsageSummary(companyId: string): Promise<UsageSummary>;
  /** Zero-filled day buckets for the Insights trend chart. */
  getDailyActivity(companyId: string, days: number): Promise<DailyActivityPoint[]>;
}

export interface DesignImportProvider {
  readonly provider: "figma";
  isConfigured(): boolean; // backend reachable at all (Edge Functions deployed)
  isConnected(companyId: string): Promise<boolean>;
  connect(companyId: string, credential: { kind: "oauth-code" | "pat"; value: string }): Promise<void>;
  importFromUrl(companyId: string, url: string): Promise<DesignImportResult>;
  /** Design-system import: pull the color + text styles of a Figma FILE into
   * palette entries + brand type styles (Feature 4 → design-system import). */
  importStylesFromUrl(companyId: string, url: string): Promise<StyleImportResult>;
  /** Re-render a frame's layers EXCLUDING the given node ids so the client
   * can recompose a background with the field elements lifted off. */
  renderLayers(
    companyId: string,
    url: string,
    excludeNodeIds: string[],
  ): Promise<import("../types").LayerRenderResult>;
}

export interface StyleImportResult {
  colors: import("../types").BrandColor[];
  typeStyles: import("../types").BrandTypeStyle[];
}

/** Swappable hook for the Template Builder's "Suggest fields" button.
 * v1 ships a stub; a vision-model implementation can drop in later. */
export type DetectFields = (imageUrl: string) => Promise<import("../types").TemplateField[]>;

export interface Stores {
  companies: CompanyStore;
  templates: TemplateStore;
  brandKits: BrandKitStore;
  brandAssets: BrandAssetStore;
  usage: UsageStore;
  people: PeopleStore;
  facilities: FacilityStore;
  submissions: SubmissionStore;
  designImport: DesignImportProvider;
  /** "supabase" or "local" — surfaced in the dev switcher so it's obvious
   * which backend is active. */
  backend: "supabase" | "local";
}
