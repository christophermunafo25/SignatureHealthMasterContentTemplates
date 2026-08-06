// Data access for the anonymous facility portal. NEVER touches Postgres or
// the Supabase client session: production traffic goes through the three
// public Edge Functions (shared portal token, service role server-side);
// the dev backend resolves the same shapes from localStorage so the whole
// facility flow is demoable without standing up Supabase.

import type { BrandAsset, BrandKit, Company, Facility, SubmissionAsset, SubmissionKind, TemplateSchema } from "./types";
import type { ReleaseForm } from "./releaseForm";
import { isSupabaseConfigured } from "./stores/supabase/client";
import { fileToDataUrl, mutate, newId, readDb } from "./stores/local/db";

/** Reserved portal ref for the root-URL public portal. Real tokens are 16+
 * chars, so this can never collide with one; the Edge Functions resolve it
 * to the single company that opted in via portal_public. */
export const HOME_REF = "~home";

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
  if (token === HOME_REF) {
    const pub = companies.filter((c) => c.portalPublic && c.portalEnabled);
    return pub.length === 1 ? pub[0] : null;
  }
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
  const stale = token !== HOME_REF && company.portalToken !== token;

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
  kind: SubmissionKind;
  facilityId: string;
  submitterName: string;
  submitterEmail?: string;
  /** The Social Media Update Form — required on every v2.2 submission. */
  releaseForm: ReleaseForm;
  /** Already-uploaded files (paths from uploadPublicFile). Dev backend:
   * `path` holds a data URL instead. */
  assets: SubmissionAsset[];
  /** Template kind only. */
  templateId?: string;
  values?: Record<string, string>;
  caption?: string;
  /** Rendered preview of what the facility saw (template kind). */
  previewBlob: Blob | null;
}

/** Upload one blob to the private submissions bucket via a signed URL
 * issued by /public-upload. Returns the storage path. */
export async function uploadPublicBlob(token: string, blob: Blob, contentType?: string): Promise<string> {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const type = contentType || blob.type || "image/png";
  const issue = await fetch(`${base}/functions/v1/public-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ token, contentType: type }),
  });
  if (issue.status === 404) throw new LinkInactiveError();
  if (!issue.ok) throw new Error(`Upload issuance failed (${issue.status})`);
  const { path, signedUrl } = (await issue.json()) as { path: string; signedUrl: string };
  const put = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": type, "x-upsert": "false" },
    body: blob,
  });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return path;
}

/** Upload one release-form file with progress. XMLHttpRequest for the PUT —
 * fetch cannot report upload progress. Returns the asset descriptor whose
 * `path` is a BARE storage path (signed at display time only). */
export async function uploadPublicFile(
  token: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<SubmissionAsset> {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const issue = await fetch(`${base}/functions/v1/public-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ token, contentType: file.type, fileName: file.name }),
  });
  if (issue.status === 404) throw new LinkInactiveError();
  if (!issue.ok) throw new Error(`Upload issuance failed (${issue.status})`);
  const { path, signedUrl } = (await issue.json()) as { path: string; signedUrl: string };

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload failed (network)"));
    xhr.send(file);
  });

  return { path, name: file.name, mimeType: file.type, size: file.size };
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

  const values = { ...(payload.values ?? {}) };
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
      kind: payload.kind,
      facilityId: payload.facilityId,
      templateId: payload.templateId,
      submitterName: payload.submitterName,
      submitterEmail: payload.submitterEmail,
      releaseForm: payload.releaseForm,
      assets: payload.assets,
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

  // Template kind resolves its template; direct kind has none.
  let template: TemplateSchema | null = null;
  if (payload.kind === "template") {
    template =
      (db.templates as TemplateSchema[]).find(
        (t) => t.id === payload.templateId && t.companyId === company.id && t.status === "published",
      ) ?? null;
    if (!template) throw new Error("Template not found");
  }

  const kit = (db.brandKits as BrandKit[]).find((k) => k.companyId === company.id) ?? null;
  const assets = (db.brandAssets as BrandAsset[]).filter((a) => a.companyId === company.id);
  const previewDataUrl = payload.previewBlob
    ? await fileToDataUrl(payload.previewBlob)
    : // Direct kind: fall back to the first image asset so the queue card
      // has a thumbnail (dev backend stores data URLs in asset paths).
      payload.assets.find((a) => a.mimeType.startsWith("image/"))?.path;

  // Q9 is the caption for both kinds — same reconciliation the Edge
  // Function performs.
  const caption = payload.releaseForm.postText;
  const values = payload.kind === "template" ? payload.values ?? {} : {};
  const releaseFlagged = payload.releaseForm.vpApproved === "No";

  const now = new Date().toISOString();
  const id = newId();
  mutate((d) => {
    d.submissions.push({
      id,
      companyId: company.id,
      kind: payload.kind,
      templateId: template?.id,
      facilityId: facility.id,
      facilityName: facility.name,
      templateName: template?.name ?? "",
      submitterName: payload.submitterName,
      submitterEmail: payload.submitterEmail,
      values,
      originalValues: { ...values },
      caption,
      originalCaption: caption,
      releaseForm: JSON.parse(JSON.stringify(payload.releaseForm)),
      assets: payload.assets,
      platforms: payload.releaseForm.platforms,
      requestedPostDate: payload.releaseForm.requestedPostDate || undefined,
      requestedPostTime: payload.releaseForm.requestedPostTime || undefined,
      vpApproved: payload.releaseForm.vpApproved === "Yes",
      releaseFlagged,
      schemaSnapshot: template ? JSON.parse(JSON.stringify(template)) : null,
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

/** Backend-agnostic release-form file upload: Supabase uploads through the
 * signed-URL flow; the dev backend stores the file as a data URL in the
 * asset's `path` (LocalSubmissionStore's previewUrl/assetUrls return stored
 * strings as-is). */
export async function uploadPublicAsset(
  token: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<SubmissionAsset> {
  if (isSupabaseConfigured) return uploadPublicFile(token, file, onProgress);
  const dataUrl = await fileToDataUrl(file);
  onProgress?.(1);
  return { path: dataUrl, name: file.name, mimeType: file.type, size: file.size };
}
