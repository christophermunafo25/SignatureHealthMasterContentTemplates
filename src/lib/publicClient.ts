// Data access for the anonymous facility portal. NEVER touches Postgres or
// the Supabase client session: production traffic goes through the
// public-portal Edge Function (token-verified, service role server-side);
// the dev backend resolves the same shapes from localStorage so the whole
// facility flow is demoable without standing up Supabase.

import type { BrandAsset, BrandKit, FacilityLink, TemplateSchema } from "./types";
import { isSupabaseConfigured } from "./stores/supabase/client";
import { readDb } from "./stores/local/db";

export interface PublicPortalData {
  facility: { name: string };
  company: { name: string };
  brandKit: BrandKit | null;
  logoUrl: string | null;
  brandAssets: BrandAsset[];
  templates?: TemplateSchema[];
  template?: TemplateSchema;
}

/** The uniform "no such link" outcome — unknown, inactive, and expired
 * tokens are indistinguishable on purpose. */
export class LinkInactiveError extends Error {
  constructor() {
    super("This link isn't active.");
    this.name = "LinkInactiveError";
  }
}

export async function fetchPublicPortal(token: string, templateId?: string): Promise<PublicPortalData> {
  return isSupabaseConfigured ? fetchRemote(token, templateId) : fetchLocal(token, templateId);
}

async function fetchRemote(token: string, templateId?: string): Promise<PublicPortalData> {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const res = await fetch(`${base}/functions/v1/public-portal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ token, templateId }),
  });
  if (res.status === 404) throw new LinkInactiveError();
  if (!res.ok) throw new Error(`Portal request failed (${res.status})`);
  return (await res.json()) as PublicPortalData;
}

/** Dev backend: same validation rules as the Edge Function, against the
 * localStorage document store. */
async function fetchLocal(token: string, templateId?: string): Promise<PublicPortalData> {
  const db = readDb();
  const link = (db.facilityLinks as FacilityLink[]).find((l) => l.token === token);
  if (!link || !link.active) throw new LinkInactiveError();
  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) throw new LinkInactiveError();

  const company = (db.companies as Array<{ id: string; name: string }>).find((c) => c.id === link.companyId);
  const kit =
    (db.brandKits as BrandKit[]).find((k) => k.companyId === link.companyId) ?? null;
  const assets = (db.brandAssets as BrandAsset[]).filter((a) => a.companyId === link.companyId);
  const logo = kit?.primaryLogoAssetId ? assets.find((a) => a.id === kit.primaryLogoAssetId) : null;

  let templates = (db.templates as TemplateSchema[]).filter(
    (t) => t.companyId === link.companyId && t.status === "published",
  );
  if (link.templateTags.length) {
    templates = templates.filter((t) => t.tags.some((tag) => link.templateTags.includes(tag)));
  }

  const base = {
    facility: { name: link.facilityName },
    company: { name: company?.name ?? "" },
    brandKit: kit ? { ...kit, typeStyles: kit.typeStyles ?? [], guidelines: [] } : null,
    logoUrl: logo?.url ?? null,
    brandAssets: assets,
  };

  if (templateId) {
    const template = templates.find((t) => t.id === templateId);
    if (!template) throw new Error("Template not found");
    return { ...base, template };
  }
  return { ...base, templates };
}

// ── Submission (anonymous writes go through Edge Functions only) ──────────

export interface PublicSubmissionPayload {
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
  const { readDb: read } = await import("./stores/local/db");
  const { mutate, newId } = await import("./stores/local/db");
  const db = read();
  const link = (db.facilityLinks as FacilityLink[]).find((l) => l.token === token);
  if (!link || !link.active) throw new LinkInactiveError();
  const template = (db.templates as TemplateSchema[]).find(
    (t) => t.id === payload.templateId && t.companyId === link.companyId && t.status === "published",
  );
  if (!template) throw new Error("Template not found");
  const kit = (db.brandKits as BrandKit[]).find((k) => k.companyId === link.companyId) ?? null;
  const assets = (db.brandAssets as BrandAsset[]).filter((a) => a.companyId === link.companyId);
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
      companyId: link.companyId,
      templateId: template.id,
      facilityLinkId: link.id,
      facilityName: link.facilityName,
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
