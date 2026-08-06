import type {
  BrandAsset,
  BrandKit,
  CanvasPreset,
  Company,
  DesignImportResult,
  Facility,
  FieldValues,
  NewTemplateInput,
  Submission,
  SubmissionStatus,
  TemplateSchema,
  TemplateStatus,
  UsageAction,
  UsageSummary,
  UsageSummaryRow,
} from "../../types";
import type {
  BrandAssetStore,
  BrandKitStore,
  CompanyStore,
  DesignImportProvider,
  FacilityStore,
  SubmissionFilter,
  SubmissionStore,
  TemplateStore,
  UsageStore,
} from "../interfaces";
import { bucketDailyActivity } from "../dailyActivity";
import { fileToDataUrl, mutate, newId, readDb } from "./db";

// Mirrors migration 0022's enabled catalog rows.
const PRESETS: CanvasPreset[] = [
  { id: "square-1440", label: "Square (1440×1440)", width: 1440, height: 1440, enabled: true, platform: "General", format: "Square post", sortOrder: 10, recommended: true },
  { id: "ig-post-1080", label: "Instagram Post (1080×1080)", width: 1080, height: 1080, enabled: true, platform: "Instagram", format: "Square post", sortOrder: 20, recommended: true },
  { id: "ig-portrait-1080", label: "Instagram Portrait (1080×1350)", width: 1080, height: 1350, enabled: true, platform: "Instagram", format: "Portrait post", sortOrder: 30, recommended: false },
  { id: "ig-story-1080", label: "Instagram Story (1080×1920)", width: 1080, height: 1920, enabled: true, platform: "Instagram", format: "Story / Reel", sortOrder: 40, recommended: false },
  { id: "fb-post-1200", label: "Facebook Post (1200×630)", width: 1200, height: 630, enabled: true, platform: "Facebook", format: "Feed post", sortOrder: 50, recommended: false },
  { id: "fb-story-1080", label: "Facebook Story (1080×1920)", width: 1080, height: 1920, enabled: true, platform: "Facebook", format: "Story", sortOrder: 60, recommended: false },
  { id: "li-post-1200", label: "LinkedIn Post (1200×627)", width: 1200, height: 627, enabled: true, platform: "LinkedIn", format: "Feed post", sortOrder: 80, recommended: false },
];

interface UsageEventRec {
  id: string;
  companyId: string;
  templateId: string;
  action: UsageAction;
  userId: string | null;
  createdAt: string;
}

export class LocalCompanyStore implements CompanyStore {
  async list(): Promise<Company[]> {
    return (readDb().companies as Company[]).slice().sort((a, b) => a.name.localeCompare(b.name));
  }
  async get(id: string): Promise<Company | null> {
    return (readDb().companies as Company[]).find((c) => c.id === id) ?? null;
  }
  async create(input: { name: string; slug: string }): Promise<Company> {
    const company: Company = { id: newId(), ...input, createdAt: new Date().toISOString() };
    mutate((db) => db.companies.push(company));
    return company;
  }
  async hasAnyCompany(): Promise<boolean> {
    return readDb().companies.length > 0;
  }
  async setNotificationEmails(companyId: string, emails: string[]): Promise<void> {
    mutate((db) => {
      const c = (db.companies as Company[]).find((x) => x.id === companyId);
      if (c) c.notificationEmails = emails;
    });
  }
  async rotatePortalToken(companyId: string, graceDays = 14): Promise<string> {
    const fresh = randomToken();
    mutate((db) => {
      const c = (db.companies as Company[]).find((x) => x.id === companyId);
      if (c) {
        c.portalTokenPrevious = c.portalToken;
        c.portalTokenPreviousExpires = c.portalToken
          ? new Date(Date.now() + graceDays * 86_400_000).toISOString()
          : undefined;
        c.portalToken = fresh;
      }
    });
    return fresh;
  }
  async setPortalEnabled(companyId: string, enabled: boolean): Promise<void> {
    mutate((db) => {
      const c = (db.companies as Company[]).find((x) => x.id === companyId);
      if (c) c.portalEnabled = enabled;
    });
  }
  async setPortalPublic(companyId: string, isPublic: boolean): Promise<void> {
    mutate((db) => {
      const c = (db.companies as Company[]).find((x) => x.id === companyId);
      if (c) c.portalPublic = isPublic;
    });
  }
  async listCanvasPresets(): Promise<CanvasPreset[]> {
    return PRESETS.filter((p) => p.enabled);
  }
}

export class LocalTemplateStore implements TemplateStore {
  async listPublished(companyId: string): Promise<TemplateSchema[]> {
    return (await this.listAll(companyId)).filter((t) => t.status === "published");
  }
  async listAll(companyId: string): Promise<TemplateSchema[]> {
    return (readDb().templates as TemplateSchema[])
      .filter((t) => t.companyId === companyId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async get(id: string): Promise<TemplateSchema | null> {
    return (readDb().templates as TemplateSchema[]).find((t) => t.id === id) ?? null;
  }
  async create(input: NewTemplateInput): Promise<TemplateSchema> {
    const now = new Date().toISOString();
    const template: TemplateSchema = { ...input, id: newId(), createdAt: now, updatedAt: now };
    mutate((db) => db.templates.push(template));
    return template;
  }
  async update(id: string, patch: Partial<NewTemplateInput>): Promise<TemplateSchema> {
    return mutate((db) => {
      const templates = db.templates as TemplateSchema[];
      const i = templates.findIndex((t) => t.id === id);
      if (i < 0) throw new Error(`Template ${id} not found`);
      templates[i] = { ...templates[i], ...patch, updatedAt: new Date().toISOString() };
      return templates[i];
    });
  }
  async setStatus(id: string, status: TemplateStatus): Promise<void> {
    await this.update(id, { status });
  }
  async duplicate(id: string, name: string): Promise<TemplateSchema> {
    const source = await this.get(id);
    if (!source) throw new Error(`Template ${id} not found`);
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = source;
    return this.create({
      ...rest,
      name,
      status: "draft",
      // New field ids; fieldKeys stay EXACTLY as-is so caption merge tags
      // keep working. backgroundUrl is copied by reference, not re-uploaded.
      fields: source.fields.map((f) => ({ ...f, id: newId() })),
    });
  }
  async delete(id: string): Promise<void> {
    mutate((db) => {
      db.templates = (db.templates as TemplateSchema[]).filter((t) => t.id !== id);
    });
  }
  async uploadBackground(_companyId: string, file: Blob): Promise<string> {
    return fileToDataUrl(file); // data URLs stand in for Storage URLs in dev
  }
}

export class LocalBrandKitStore implements BrandKitStore {
  async getActive(companyId: string): Promise<BrandKit | null> {
    const kit = (readDb().brandKits as Array<Partial<BrandKit> & BrandKit>).find(
      (k) => k.companyId === companyId,
    );
    if (!kit) return null;
    // Kits saved before the rules engine existed lack the new arrays.
    return { ...kit, typeStyles: kit.typeStyles ?? [], guidelines: kit.guidelines ?? [] };
  }
  async upsert(companyId: string, kit: Omit<BrandKit, "id" | "companyId">): Promise<BrandKit> {
    return mutate((db) => {
      const kits = db.brandKits as BrandKit[];
      const i = kits.findIndex((k) => k.companyId === companyId);
      const next: BrandKit = { ...kit, id: i >= 0 ? kits[i].id : newId(), companyId };
      if (i >= 0) kits[i] = next;
      else kits.push(next);
      return next;
    });
  }
}

export class LocalBrandAssetStore implements BrandAssetStore {
  async list(companyId: string, kind?: BrandAsset["kind"]): Promise<BrandAsset[]> {
    return (readDb().brandAssets as BrandAsset[]).filter(
      (a) => a.companyId === companyId && (!kind || a.kind === kind),
    );
  }
  async upload(
    companyId: string,
    kind: BrandAsset["kind"],
    file: File,
    metadata: BrandAsset["metadata"] = {},
  ): Promise<BrandAsset> {
    const asset: BrandAsset = {
      id: newId(),
      companyId,
      kind,
      name: file.name,
      url: await fileToDataUrl(file),
      metadata,
      createdAt: new Date().toISOString(),
    };
    mutate((db) => db.brandAssets.push(asset));
    return asset;
  }
  async remove(id: string): Promise<void> {
    mutate((db) => {
      db.brandAssets = (db.brandAssets as BrandAsset[]).filter((a) => a.id !== id);
    });
  }
}

export class LocalUsageStore implements UsageStore {
  async record(companyId: string, templateId: string, action: UsageAction, userId?: string): Promise<void> {
    const event: UsageEventRec = {
      id: newId(),
      companyId,
      templateId,
      action,
      userId: userId ?? null,
      createdAt: new Date().toISOString(),
    };
    mutate((db) => db.usageEvents.push(event));
  }
  async getUsageSummary(companyId: string): Promise<UsageSummary> {
    const db = readDb();
    const templates = db.templates as TemplateSchema[];
    const byTemplate = new Map<string, UsageSummaryRow>();
    for (const e of (db.usageEvents as UsageEventRec[]).filter((e) => e.companyId === companyId)) {
      const row = byTemplate.get(e.templateId) ?? {
        templateId: e.templateId,
        templateName: templates.find((t) => t.id === e.templateId)?.name ?? "(deleted template)",
        opens: 0,
        downloads: 0,
        lastUsedAt: null,
      };
      if (e.action === "open") row.opens += 1;
      else row.downloads += 1;
      if (!row.lastUsedAt || e.createdAt > row.lastUsedAt) row.lastUsedAt = e.createdAt;
      byTemplate.set(e.templateId, row);
    }
    const rows = [...byTemplate.values()].sort(
      (a, b) => b.downloads - a.downloads || b.opens - a.opens,
    );
    return { rows, totalDownloads: rows.reduce((n, r) => n + r.downloads, 0) };
  }
  async getDailyActivity(companyId: string, days: number) {
    const db = readDb();
    return bucketDailyActivity(
      (db.usageEvents as UsageEventRec[]).filter((e) => e.companyId === companyId),
      days,
    );
  }
}

/** Dev-mode facility roster behind the shared portal link. */
export class LocalFacilityStore implements FacilityStore {
  async list(companyId: string): Promise<Facility[]> {
    return (readDb().facilities as Facility[])
      .filter((f) => f.companyId === companyId)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.shortName.localeCompare(b.shortName));
  }

  async create(companyId: string, input: { name: string; shortName: string }): Promise<Facility> {
    const facility: Facility = {
      id: newId(),
      companyId,
      name: input.name,
      shortName: input.shortName,
      sortOrder: 100,
      active: true,
      createdAt: new Date().toISOString(),
    };
    mutate((db) => db.facilities.push(facility));
    return facility;
  }

  async bulkCreate(companyId: string, rows: Array<{ name: string; shortName: string }>): Promise<Facility[]> {
    const out: Facility[] = [];
    for (const r of rows) out.push(await this.create(companyId, r));
    return out;
  }

  async rename(id: string, patch: { name?: string; shortName?: string }): Promise<void> {
    mutate((db) => {
      const f = (db.facilities as Facility[]).find((x) => x.id === id);
      if (f) {
        if (patch.name !== undefined) f.name = patch.name;
        if (patch.shortName !== undefined) f.shortName = patch.shortName;
      }
    });
  }

  async setActive(id: string, active: boolean): Promise<void> {
    mutate((db) => {
      const f = (db.facilities as Facility[]).find((x) => x.id === id);
      if (f) f.active = active;
    });
  }
}

/** 24 random bytes as URL-safe base64 — the same shape the production RPC
 * mints (192 bits of entropy). Dev backend only. */
export function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/** Rows written before v2.2 lack the kind/assets/release columns. */
const withSubmissionDefaults = (s: Submission): Submission => ({
  ...s,
  kind: s.kind ?? "template",
  assets: s.assets ?? [],
  platforms: s.platforms ?? [],
  releaseFlagged: s.releaseFlagged ?? false,
});

/** Dev-mode review queue: full implementation so the whole facility →
 * review pipeline is demoable without Supabase. */
export class LocalSubmissionStore implements SubmissionStore {
  /** The dev backend's equivalent of the Supabase applyFilter — same
   * SubmissionFilter semantics against the in-memory rows. */
  private filtered(companyId: string, filter?: SubmissionFilter): Submission[] {
    let rows = (readDb().submissions as Submission[])
      .filter((s) => s.companyId === companyId)
      .map(withSubmissionDefaults);
    if (filter?.status && filter.status !== "all") rows = rows.filter((s) => s.status === filter.status);
    if (filter?.statuses?.length) rows = rows.filter((s) => filter.statuses!.includes(s.status));
    if (filter?.kind && filter.kind !== "all") rows = rows.filter((s) => s.kind === filter.kind);
    if (filter?.facilityId) rows = rows.filter((s) => s.facilityId === filter.facilityId);
    if (filter?.templateId) rows = rows.filter((s) => s.templateId === filter.templateId);
    if (filter?.from) rows = rows.filter((s) => s.createdAt >= filter.from!);
    if (filter?.to) rows = rows.filter((s) => s.createdAt <= filter.to!);
    if (filter?.postDateFrom) {
      rows = rows.filter((s) => s.requestedPostDate && s.requestedPostDate >= filter.postDateFrom!);
    }
    if (filter?.postDateTo) {
      rows = rows.filter((s) => s.requestedPostDate && s.requestedPostDate <= filter.postDateTo!);
    }
    if (filter?.platform) rows = rows.filter((s) => s.platforms.includes(filter.platform!));
    if (filter?.flaggedOnly) rows = rows.filter((s) => s.releaseFlagged);
    if (filter?.search?.trim()) {
      const q = filter.search.trim().toLowerCase();
      rows = rows.filter(
        (s) =>
          s.facilityName.toLowerCase().includes(q) ||
          s.submitterName.toLowerCase().includes(q) ||
          s.caption.toLowerCase().includes(q) ||
          s.templateName.toLowerCase().includes(q),
      );
    }
    const dir = filter?.orderDir === "asc" ? 1 : -1;
    if (filter?.orderBy === "requestedPostDate") {
      return rows.slice().sort((a, b) => {
        const av = a.requestedPostDate ?? "";
        const bv = b.requestedPostDate ?? "";
        if (av !== bv) return av < bv ? -dir : dir;
        return b.createdAt.localeCompare(a.createdAt);
      });
    }
    return rows.slice().sort((a, b) => dir * a.createdAt.localeCompare(b.createdAt));
  }

  async list(companyId: string, filter?: SubmissionFilter): Promise<Submission[]> {
    let rows = this.filtered(companyId, filter);
    if (filter?.limit !== undefined) {
      const offset = filter.offset ?? 0;
      rows = rows.slice(offset, offset + filter.limit);
    }
    return rows;
  }

  async counts(
    companyId: string,
    filter?: Omit<SubmissionFilter, "status" | "statuses" | "limit" | "offset">,
  ): Promise<Record<SubmissionStatus, number>> {
    const rows = this.filtered(companyId, filter as SubmissionFilter);
    const out: Record<SubmissionStatus, number> = {
      submitted: 0,
      approved: 0,
      posted: 0,
      archived: 0,
      declined: 0,
    };
    for (const s of rows) out[s.status] += 1;
    return out;
  }

  async get(id: string): Promise<Submission | null> {
    const found = (readDb().submissions as Submission[]).find((s) => s.id === id);
    return found ? withSubmissionDefaults(found) : null;
  }

  async update(
    id: string,
    patch: Partial<Pick<Submission, "values" | "caption" | "status" | "internalNote" | "declineReason">>,
  ): Promise<Submission> {
    return mutate((db) => {
      const rows = db.submissions as Submission[];
      const i = rows.findIndex((s) => s.id === id);
      if (i < 0) throw new Error(`Submission ${id} not found`);
      const cur = rows[i];
      const now = new Date().toISOString();
      const isReview =
        patch.values !== undefined || patch.caption !== undefined || patch.status !== undefined;
      const nextValues = patch.values ?? cur.values;
      const nextCaption = patch.caption ?? cur.caption;
      const diverged =
        JSON.stringify(nextValues) !== JSON.stringify(cur.originalValues) ||
        nextCaption !== cur.originalCaption;
      rows[i] = {
        ...cur,
        ...patch,
        ...(isReview && !cur.reviewedAt ? { reviewedAt: now, reviewedBy: "dev-admin" } : {}),
        ...(isReview && !cur.editedAt && diverged ? { editedAt: now, editedBy: "dev-admin" } : {}),
        ...(patch.status === "posted" ? { postedAt: now } : {}),
        ...(patch.status === "submitted" && patch.declineReason === undefined
          ? { declineReason: undefined }
          : {}),
        updatedAt: now,
      };
      return rows[i];
    });
  }

  async stats(companyId: string) {
    const rows = (readDb().submissions as Submission[]).filter((s) => s.companyId === companyId);
    const cutoff30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
    return {
      awaitingReview: rows.filter((s) => s.status === "submitted").length,
      approvedUnposted: rows.filter((s) => s.status === "approved").length,
      posted30d: rows.filter((s) => s.status === "posted" && s.updatedAt >= cutoff30).length,
      declined30d: rows.filter((s) => s.status === "declined" && s.updatedAt >= cutoff30).length,
    };
  }

  async countNew(companyId: string): Promise<number> {
    return (readDb().submissions as Submission[]).filter(
      (s) => s.companyId === companyId && s.status === "submitted",
    ).length;
  }

  async remove(id: string): Promise<void> {
    mutate((db) => {
      db.submissions = (db.submissions as Submission[]).filter((s) => s.id !== id);
    });
  }

  async previewUrl(path: string): Promise<string | null> {
    // Dev backend stores data URLs directly in preview_path.
    return path || null;
  }
  async signedValues(_schema: TemplateSchema, values: FieldValues): Promise<FieldValues> {
    // Dev backend keeps data URLs in values — nothing to sign.
    return values;
  }
  async assetUrls(assets: import("../../types").SubmissionAsset[]): Promise<Record<string, string>> {
    // Dev backend stores data URLs in asset paths — each keys itself.
    return Object.fromEntries(assets.map((a) => [a.path, a.path]));
  }
}

/** Dev mode has no real users — People management needs the Supabase backend. */
export class LocalPeopleStore {
  async list(): Promise<never[]> {
    return [];
  }
  async invite(): Promise<never> {
    throw new Error("Inviting people requires the Supabase backend with auth enabled.");
  }
  async setRole(): Promise<void> {
    throw new Error("Requires the Supabase backend.");
  }
  async remove(): Promise<void> {
    throw new Error("Requires the Supabase backend.");
  }
}

/** Dev mode has no Edge Functions, so Figma import is unavailable — the
 * Template Builder detects this and shows only the manual PNG path. */
export class LocalDesignImportProvider implements DesignImportProvider {
  readonly provider = "figma" as const;
  isConfigured(): boolean {
    return false;
  }
  async isConnected(): Promise<boolean> {
    return false;
  }
  async connect(): Promise<void> {
    throw new Error("Figma integration requires the Supabase backend (see .env.example).");
  }
  async importFromUrl(): Promise<DesignImportResult> {
    throw new Error("Figma integration requires the Supabase backend (see .env.example).");
  }
  async importStylesFromUrl(): Promise<never> {
    throw new Error("Figma integration requires the Supabase backend (see .env.example).");
  }
  async renderLayers(): Promise<never> {
    throw new Error("Figma integration requires the Supabase backend (see .env.example).");
  }
}
