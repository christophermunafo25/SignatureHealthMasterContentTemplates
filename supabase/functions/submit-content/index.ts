// Anonymous submission creation. Token-verified (verify_jwt = false); the
// client's claims are re-validated server-side — the client validates for
// UX, this function validates for truth.
//
// v2.2: two intake kinds share this endpoint. 'template' is the brand
// template flow (frozen schema snapshot, filled values); 'direct' is a
// facility uploading their own media with proposed copy. Both carry the
// Social Media Update Form (release_form).
//
// POST { token, kind, facilityId, submitterName, submitterEmail,
//        releaseForm, assets, previewPath?,
//        templateId?, values?, caption? }        // template kind only
// → { ok: true, submissionId }

import { handleOptions, json, serviceClient } from "../_shared/figma.ts";
import { linkNotFound, rateLimitPublic, requireFacility, requirePortalCompany } from "../_shared/publicAuth.ts";
import { facilityLogoUrl, loadBrandKit, toTemplate } from "../_shared/portalData.ts";
import { sendSubmissionNotification } from "../_shared/email.ts";
import {
  ALLOWED_UPLOAD_MIME,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  isBlocked,
  validateReleaseForm,
  type ReleaseForm,
} from "../_shared/releaseForm.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

/** Field values must be strings; image values must be storage paths inside
 * the link's company prefix (uploaded via /public-upload) — never data URLs
 * (they would bloat the jsonb into the megabytes) and never another
 * tenant's path. */
function validateValues(
  template: Row,
  values: Record<string, unknown>,
  companyId: string,
): string | null {
  const fields: Row[] = (template.fields ?? []).filter((f: Row) => !f.static);
  const known = new Set(fields.map((f) => f.fieldKey));
  for (const key of Object.keys(values)) {
    if (!known.has(key)) return `Unknown field: ${key}`;
    if (typeof values[key] !== "string") return `Invalid value for ${key}`;
  }
  for (const f of fields) {
    const v = (values[f.fieldKey] as string | undefined) ?? "";
    if (f.required && !v) return `Missing required field: ${f.label}`;
    if (!v) continue;
    if (f.type === "image") {
      if (v.startsWith("data:")) return `Image for ${f.label} must be uploaded, not inlined`;
      if (!v.startsWith(`${companyId}/`) || v.includes("..")) {
        return `Invalid image path for ${f.label}`;
      }
    } else {
      if (f.maxLength && v.length > f.maxLength) {
        return `${f.label} exceeds ${f.maxLength} characters`;
      }
      if (f.type === "select" && f.options?.length && !f.options.includes(v)) {
        return `Invalid option for ${f.label}`;
      }
    }
  }
  return null;
}

/** A storage path claimed by the client must live inside the link's company
 * prefix and contain no traversal. */
const validPath = (path: unknown, companyId: string): path is string =>
  typeof path === "string" && path.startsWith(`${companyId}/`) && !path.includes("..");

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Row;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const db = serviceClient();
  const token = typeof body.token === "string" ? body.token : "";
  if (!(await rateLimitPublic(db, "submit", req, token, 120, 20))) {
    return json({ error: "Too many requests" }, 429);
  }

  // 1. Validate the shared portal token, then the facility. A submission
  //    with no valid facility is close to useless to the social team —
  //    reject rather than accept unattributed content.
  const portal = await requirePortalCompany(db, token);
  if (!portal) return linkNotFound();
  const facility = await requireFacility(db, portal.companyId, body.facilityId);
  if (!facility) return json({ error: "Pick your facility before submitting." }, 400);

  const kind = body.kind === "direct" ? "direct" : "template";

  const submitterName = typeof body.submitterName === "string" ? body.submitterName.trim() : "";
  if (submitterName.length < 2 || submitterName.length > 120) {
    return json({ error: "Submitter name is required" }, 400);
  }
  // Email is required on every submission — the social team needs a way to
  // reach the submitter (and the decline flow emails them the reason).
  const submitterEmail =
    typeof body.submitterEmail === "string" && /^\S+@\S+\.\S+$/.test(body.submitterEmail.trim())
      ? body.submitterEmail.trim().slice(0, 200)
      : null;
  if (!submitterEmail) {
    return json({ error: "A valid email is required." }, 400);
  }

  // 2. The release form is required on every v2.2 submission and is
  //    re-validated here with the SAME rules the client ran.
  const releaseForm = (body.releaseForm && typeof body.releaseForm === "object"
    ? body.releaseForm
    : null) as ReleaseForm | null;
  if (!releaseForm) return json({ error: "The release form is required." }, 400);

  const assets: Array<{ path: string; name: string; mimeType: string; size: number }> =
    Array.isArray(body.assets) ? body.assets : [];
  if (assets.length > MAX_UPLOAD_FILES) {
    return json({ error: `At most ${MAX_UPLOAD_FILES} files per submission.` }, 400);
  }
  for (const a of assets) {
    if (!a || !validPath(a.path, portal.companyId)) {
      return json({ error: "Invalid asset path" }, 400);
    }
    if (typeof a.mimeType !== "string" || !ALLOWED_UPLOAD_MIME[a.mimeType]) {
      return json({ error: "Unsupported asset type" }, 400);
    }
    if (typeof a.size !== "number" || a.size < 0 || a.size > MAX_UPLOAD_BYTES) {
      return json({ error: "Asset exceeds the 200 MB limit" }, 400);
    }
    if (typeof a.name !== "string" || !a.name) return json({ error: "Asset name missing" }, 400);
  }

  const issues = validateReleaseForm(releaseForm, {
    hasGeneratedGraphic: kind === "template",
    assetCount: assets.length,
  });
  const blockingIssues = issues.filter((i) => i.severity === "blocking");
  if (isBlocked(issues)) {
    return json({ error: blockingIssues[0].message, issues }, 400);
  }
  const releaseFlagged = issues.some((i) => i.severity === "flag");

  const previewPath = typeof body.previewPath === "string" ? body.previewPath : null;
  if (previewPath && !validPath(previewPath, portal.companyId)) {
    return json({ error: "Invalid preview path" }, 400);
  }

  // 3. Template kind: load the template server-side (NEVER trust the
  //    client's templateId to belong to the link's company) and re-validate
  //    every field value. Direct kind: no template lookup at all.
  let template: Row | null = null;
  let values: Record<string, unknown> = {};
  if (kind === "template") {
    const { data: tplRow } = await db
      .from("templates")
      .select("*, template_fields(*)")
      .eq("id", typeof body.templateId === "string" ? body.templateId : "")
      .eq("company_id", portal.companyId)
      .eq("status", "published")
      .maybeSingle();
    if (!tplRow) return json({ error: "Template not found" }, 404);
    template = toTemplate(tplRow);

    values = (body.values && typeof body.values === "object" ? body.values : {}) as Record<string, unknown>;
    const invalid = validateValues(template, values, portal.companyId);
    if (invalid) return json({ error: invalid }, 400);
  }

  // 4. Caption reconciliation: Q9 IS the caption. The modal has already
  //    written the edited caption into postText; the server takes postText
  //    as authoritative so the two can never diverge.
  const caption = String(releaseForm.postText ?? "").slice(0, 4000);

  // 5. Freeze brand at submit time (both kinds — direct submissions stay
  //    renderable in the admin UI too).
  const { brandKit, logoUrl, brandAssets } = await loadBrandKit(db, portal.companyId);

  // 6. Insert with original_* equal to the submitted values.
  const { data: inserted, error: insErr } = await db
    .from("submissions")
    .insert({
      company_id: portal.companyId,
      kind,
      template_id: template ? template.id : null,
      facility_id: facility.id,
      // Denormalized: the current legal name, stable even if the roster
      // row is later renamed or deactivated.
      facility_name: facility.name,
      template_name: template ? template.name : "",
      submitter_name: submitterName,
      submitter_email: submitterEmail,
      values: kind === "template" ? values : {},
      original_values: kind === "template" ? values : {},
      caption,
      original_caption: caption,
      schema_snapshot: template, // null for direct — column is nullable as of 0026
      brand_snapshot: {
        brandKit,
        logoUrl,
        brandAssets,
        // Frozen facility identity for facility_logo elements — review and
        // export read THIS, never the live roster, so a logo swapped after
        // submission can't retroactively change a queued item.
        facility: {
          name: facility.name,
          shortName: facility.short_name || facility.name,
          logoUrl: facilityLogoUrl(facility.logo_storage_path),
        },
      },
      preview_path: previewPath,
      release_form: releaseForm,
      asset_paths: assets,
      platforms: releaseForm.platforms ?? [],
      requested_post_date: releaseForm.requestedPostDate || null,
      requested_post_time: releaseForm.requestedPostTime || null,
      vp_approved: releaseForm.vpApproved === "Yes",
      release_flagged: releaseFlagged,
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    console.error("submission insert failed", insErr);
    return json({ error: "Couldn't save the submission" }, 500);
  }
  const submissionId = (inserted as { id: string }).id;

  // 7. Submission volume shows up in Insights as facility downloads —
  //    template kind only (a usage event carries a template_id).
  if (template) {
    void db
      .from("usage_events")
      .insert({
        company_id: portal.companyId,
        template_id: template.id,
        action: "download",
        user_id: null,
        facility_id: facility.id,
      })
      .then(() => {});
  }

  // 8. Notify the social team (and confirm to the submitter). Email
  //    failure must NOT fail the submission: a lost email is recoverable
  //    from the queue, a lost submission is not.
  try {
    await sendSubmissionNotification(db, {
      companyId: portal.companyId,
      submissionId,
      kind,
      facilityName: facility.name,
      templateName: template ? template.name : "",
      submitterName,
      submitterEmail,
      caption,
      previewPath,
      releaseForm,
      assetCount: assets.length,
      releaseFlagged,
    });
  } catch (e) {
    console.error("notification failed (submission saved)", e);
  }

  return json({ ok: true, submissionId });
});
