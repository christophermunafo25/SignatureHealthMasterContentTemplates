// Data access for the anonymous facility portal. NEVER touches Postgres or
// the Supabase client session: production traffic goes through the three
// public Edge Functions (shared portal token, service role server-side);
// the dev backend resolves the same shapes from localStorage so the whole
// facility flow is demoable without standing up Supabase.

import type { BrandAsset, BrandKit, Company, Facility, TemplateSchema } from "./types";
import { isSupabaseConfigured } from "./stores/supabase/client";
import { mutate, newId, readDb } from "./stores/local/db";

export interface PublicFacility {
  id: string;
  name: string;
  shortName: string;
  state?: string;
}

export interface PublicPortalData {
  company: { name: string };
  facilities: PublicFacility[];
  brandKit: BrandKit | null;
  logoUrl: string | null;
  brandAssets: BrandAsset[];
  templates?: TemplateSchema[];
  template?: TemplateSchema;
  /** Matched on the previous token — show the quiet replace banner. */
  tokenStale: boolean;
}

/** The uniform "no such link" outcome — unknown, disabled, and expired
 * tokens are indistinguishable on purpose. */
export class LinkInactiveError extends Error {
  constructor() {
    super("This link isn't active.");
    this.name = "LinkInactiveError";
  }
}

export async function fetchPublicPortal(
  token: string,
  opts?: { templateId?: string; facilityId?: string },
): Promise<PublicPortalData> {
  return isSupabaseConfigured ? fetchRemote(token, opts) : fetchLocal(token, opts);
}

async function fetchRemote(
  token: string,
  opts?: { templateId?: string; facilityId?: string },
): Promise<PublicPortalData> {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const res = await fetch(`${base}/functions/v1/public-portal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ token, templateId: opts?.templateId, facilityId: opts?.facilityId }),
  });
  if (res.status === 404) throw new LinkInactiveError();
  if (!res.ok) throw new Error(`Portal request failed (${res.status})`);
  return (await res.json()) as PublicPortalData;
}

/** Dev backend: same resolution rules as the Edge Functions, against the
 * localStorage document store. */
function resolveLocalCompany(token: string): (Company & { id: string }) | null {
  const db = readDb();
  const companies = db.companies as Company[];
  const byCurrent = companies.find((c) => c.portalToken === token);
  if (byCurrent) return byCurrent.portalEnabled ? byCurrent : null;
  const byPrev = companies.find((c) => c.portalTokenPrevious === token);
  if (!byPrev || !byPrev.portalEnabled) return null;
  if (
    !byPrev.portalTokenPreviousExpires ||
    new Date(byPrev.portalTokenPreviousExpires).getTime() < Date.now()
  ) {
    return null;
  }
  return byPrev;
}

const isFillable = (t: TemplateSchema) => t.fields.some((f) => !f.static);

async function fetchLocal(
  token: string,
  opts?: { templateId?: string; facilityId?: string },
): Promise<PublicPortalData> {
  const company = resolveLocalCompany(token);
  if (!company) throw new LinkInactiveError();
  const stale = company.portalToken !== token;

  const db = readDb();
  const facilities = (db.facilities as Facility[])
    .filter((f) => f.companyId === company.id && f.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.shortName.localeCompare(b.shortName))
    .map((f) => ({ id: f.id, name: f.name, shortName: f.shortName || f.name, state: f.state }));

  const kit = (db.brandKits as BrandKit[]).find((k) => k.companyId === company.id) ?? null;
  const assets = (db.brandAssets as BrandAsset[]).filter((a) => a.companyId === company.id);
  const logo = kit?.primaryLogoAssetId ? assets.find((a) => a.id === kit.primaryLogoAssetId) : null;

  const templates = (db.templates as TemplateSchema[]).filter(
    (t) => t.companyId === company.id && t.status === "published" && isFillable(t),
  );

  const base: PublicPortalData = {
    company: { name: company.name },
    facilities,
    brandKit: kit ? { ...kit, typeStyles: kit.typeStyles ?? [], guidelines: [] } : null,
    logoUrl: logo?.url ?? null,
    brandAssets: assets,
    tokenStale: stale,
  };

  if (opts?.templateId) {
    const template = templates.find((t) => t.id === opts.templateId);
    if (!template) throw new Error("Template not found");
    return { ...base, template };
  }
  return { ...base, templates };
}

// ── Submission (anonymous writes go through Edge Functions only) ──────────

export interface PublicSubmissionPayload {
  facilityId: string;
  templateId: string;
  submitterName: string;
  submitterEmail?: string;
  values: Record<string, string>;
  caption: string;
  /** Rendered preview of what the facility saw. */
  previewBlob: Blob | null;
}

/** Upload one blob to the private submissions bucket via a signed URL
 * issued by /public-upload. Returns the storage path. */
async function uploadPublicBlob(token: string, blob: Blob): Promise<string> {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const issue = await fetch(`${base}/functions/v1/public-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ token, contentType: blob.type || "image/png" }),
  });
  if (issue.status === 404) throw new LinkInactiveError();
  if (!issue.ok) throw new Error(`Upload issuance failed (${issue.status})`);
  const { path, signedUrl } = (await issue.json()) as { path: string; signedUrl: string };
  const put = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": blob.type || "image/png", "x-upsert": "false" },
    body: blob,
  });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return path;
}

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => (await fetch(dataUrl)).blob();

/** Create the submission. Image field values arrive as in-memory data URLs
 * and are uploaded to storage first — the values jsonb carries storage
 * paths, never megabytes of base64 (production). The dev backend stores the
 * document (data URLs included) straight into localStorage. */
export async function submitPublicContent(
  token: string,
  payload: PublicSubmissionPayload,
): Promise<{ submissionId: string }> {
  if (!isSupabaseConfigured) return submitLocal(token, payload);

  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const values = { ...payload.values };
  for (const key of Object.keys(values)) {
    if (values[key]?.startsWith("data:")) {
      values[key] = await uploadPublicBlob(token, await dataUrlToBlob(values[key]));
    }
  }
  const previewPath = payload.previewBlob ? await uploadPublicBlob(token, payload.previewBlob) : undefined;

  const res = await fetch(`${base}/functions/v1/submit-content`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({
      token,
      facilityId: payload.facilityId,
      templateId: payload.templateId,
      submitterName: payload.submitterName,
      submitterEmail: payload.submitterEmail,
      values,
      caption: payload.caption,
      previewPath,
    }),
  });
  if (res.status === 404) throw new LinkInactiveError();
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Submission failed (${res.status})`);
  }
  const out = (await res.json()) as { submissionId: string };
  return { submissionId: out.submissionId };
}

async function submitLocal(
  token: string,
  payload: PublicSubmissionPayload,
): Promise<{ submissionId: string }> {
  const company = resolveLocalCompany(token);
  if (!company) throw new LinkInactiveError();
  const db = readDb();
  const facility = (db.facilities as Facility[]).find(
    (f) => f.id === payload.facilityId && f.companyId === company.id && f.active,
  );
  if (!facility) throw new Error("Pick your facility before submitting.");
  const template = (db.templates as TemplateSchema[]).find(
    (t) => t.id === payload.templateId && t.companyId === company.id && t.status === "published",
  );
  if (!template) throw new Error("Template not found");
  const kit = (db.brandKits as BrandKit[]).find((k) => k.companyId === company.id) ?? null;
  const assets = (db.brandAssets as BrandAsset[]).filter((a) => a.companyId === company.id);
  const previewDataUrl = payload.previewBlob
    ? await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(payload.previewBlob!);
      })
    : undefined;
  const now = new Date().toISOString();
  const id = newId();
  mutate((d) => {
    d.submissions.push({
      id,
      companyId: company.id,
      templateId: template.id,
      facilityId: facility.id,
      facilityName: facility.name,
      templateName: template.name,
      submitterName: payload.submitterName,
      submitterEmail: payload.submitterEmail,
      values: payload.values,
      originalValues: { ...payload.values },
      caption: payload.caption,
      originalCaption: payload.caption,
      schemaSnapshot: JSON.parse(JSON.stringify(template)),
      brandSnapshot: { brandKit: kit ? JSON.parse(JSON.stringify(kit)) : null, brandAssets: assets },
      previewPath: previewDataUrl,
      status: "submitted",
      internalNote: "",
      createdAt: now,
      updatedAt: now,
    });
  });
  return { submissionId: id };
}
