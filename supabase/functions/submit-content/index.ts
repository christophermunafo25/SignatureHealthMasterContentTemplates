// Anonymous submission creation. Token-verified (verify_jwt = false); the
// client's claims are re-validated server-side — the client validates for
// UX, this function validates for truth.
//
// POST { token, facilityId, templateId, submitterName, submitterEmail?,
//        values, caption, previewPath? }
// → { ok: true, submissionId }

import { handleOptions, json, serviceClient } from "../_shared/figma.ts";
import { linkNotFound, rateLimitPublic, requireFacility, requirePortalCompany } from "../_shared/publicAuth.ts";
import { loadBrandKit, toTemplate } from "../_shared/portalData.ts";
import { sendSubmissionNotification } from "../_shared/email.ts";

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

  const submitterName = typeof body.submitterName === "string" ? body.submitterName.trim() : "";
  if (submitterName.length < 2 || submitterName.length > 120) {
    return json({ error: "Submitter name is required" }, 400);
  }
  const submitterEmail =
    typeof body.submitterEmail === "string" && body.submitterEmail.includes("@")
      ? body.submitterEmail.trim().slice(0, 200)
      : null;
  const caption = typeof body.caption === "string" ? body.caption.slice(0, 4000) : "";
  const previewPath = typeof body.previewPath === "string" ? body.previewPath : null;
  if (previewPath && (!previewPath.startsWith(`${portal.companyId}/`) || previewPath.includes(".."))) {
    return json({ error: "Invalid preview path" }, 400);
  }

  // 2. Load the template server-side. NEVER trust the client's templateId to
  //    belong to the link's company.
  const { data: tplRow } = await db
    .from("templates")
    .select("*, template_fields(*)")
    .eq("id", typeof body.templateId === "string" ? body.templateId : "")
    .eq("company_id", portal.companyId)
    .eq("status", "published")
    .maybeSingle();
  if (!tplRow) return json({ error: "Template not found" }, 404);
  const template = toTemplate(tplRow);

  // 3. Re-validate every field value against the template's own guardrails.
  const values = (body.values && typeof body.values === "object" ? body.values : {}) as Record<string, unknown>;
  const invalid = validateValues(template, values, portal.companyId);
  if (invalid) return json({ error: invalid }, 400);

  // 4. Freeze schema and brand at submit time (see D3).
  const { brandKit, logoUrl, brandAssets } = await loadBrandKit(db, portal.companyId);

  // 5. Insert with original_* equal to the submitted values.
  const { data: inserted, error: insErr } = await db
    .from("submissions")
    .insert({
      company_id: portal.companyId,
      template_id: template.id,
      facility_id: facility.id,
      // Denormalized: the current legal name, stable even if the roster
      // row is later renamed or deactivated.
      facility_name: facility.name,
      template_name: template.name,
      submitter_name: submitterName,
      submitter_email: submitterEmail,
      values,
      original_values: values,
      caption,
      original_caption: caption,
      schema_snapshot: template,
      brand_snapshot: { brandKit, logoUrl, brandAssets },
      preview_path: previewPath,
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    console.error("submission insert failed", insErr);
    return json({ error: "Couldn't save the submission" }, 500);
  }
  const submissionId = (inserted as { id: string }).id;

  // 6. Submission volume shows up in Insights as facility downloads.
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

  // 7-8. Notify the social team (and confirm to the submitter). Email
  //      failure must NOT fail the submission: a lost email is recoverable
  //      from the queue, a lost submission is not.
  try {
    await sendSubmissionNotification(db, {
      companyId: portal.companyId,
      submissionId,
      facilityName: facility.name,
      templateName: template.name,
      submitterName,
      submitterEmail,
      caption,
      previewPath,
    });
  } catch (e) {
    console.error("notification failed (submission saved)", e);
  }

  return json({ ok: true, submissionId });
});
