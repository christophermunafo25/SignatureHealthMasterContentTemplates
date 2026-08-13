// Anonymous facility portal reads. Verified by the company's shared portal
// token, not by JWT (verify_jwt = false). Anonymous clients never talk to
// Postgres — this function reads with the service role, scoped by the
// token's company.
//
// POST { token, templateId?, facilityId? }
//   → without templateId: { company, facilities, brandKit, logoUrl,
//                           brandAssets, templates, tokenStale }
//   → with templateId:    { company, facilities, brandKit, logoUrl,
//                           brandAssets, template, tokenStale }
// facilityId (optional, validated) attributes the open usage event.
// Unknown / disabled / expired tokens → 404, never 403.

import { handleOptions, json, serviceClient } from "../_shared/figma.ts";
import {
  linkNotFound,
  rateLimitPublic,
  requireFacility,
  requirePortalCompany,
} from "../_shared/publicAuth.ts";
import { facilityLogoUrl, loadBrandKit, loadPublishedTemplates, toTemplate } from "../_shared/portalData.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

/** Published AND usable: a template whose fields are all static presents a
 * form with nothing to fill. */
const isFillable = (t: Row) => (t.fields ?? []).some((f: Row) => !f.static);

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { token?: unknown; templateId?: unknown; facilityId?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const db = serviceClient();
  const token = typeof body.token === "string" ? body.token : "";
  if (!(await rateLimitPublic(db, "portal", req, token))) {
    return json({ error: "Too many requests" }, 429);
  }

  const portal = await requirePortalCompany(db, token);
  if (!portal) return linkNotFound();

  const { data: facilityRows } = await db
    .from("facilities")
    .select("id, name, short_name, state, logo_storage_path")
    .eq("company_id", portal.companyId)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  const facilities = (facilityRows ?? []).map((f: Row) => ({
    id: f.id,
    name: f.name,
    shortName: f.short_name || f.name,
    state: f.state ?? undefined,
    logoUrl: facilityLogoUrl(f.logo_storage_path),
  }));

  const { brandKit, logoUrl, brandAssets } = await loadBrandKit(db, portal.companyId);

  const base = {
    company: { name: portal.companyName },
    facilities,
    brandKit,
    logoUrl,
    brandAssets,
    tokenStale: portal.tokenStale,
  };

  // Optional facility context for usage attribution.
  const facility = await requireFacility(db, portal.companyId, body.facilityId);

  if (typeof body.templateId === "string" && body.templateId) {
    const { data: row } = await db
      .from("templates")
      .select("*, template_fields(*)")
      .eq("id", body.templateId)
      .eq("company_id", portal.companyId) // never serve another tenant's template
      .eq("status", "published")
      .maybeSingle();
    if (!row) return json({ error: "Template not found" }, 404);
    const template = toTemplate(row);
    if (!isFillable(template)) return json({ error: "Template not found" }, 404);
    // Anonymous open event, attributed to the facility when known.
    void db
      .from("usage_events")
      .insert({
        company_id: portal.companyId,
        template_id: template.id,
        action: "open",
        user_id: null,
        facility_id: facility?.id ?? null,
      })
      .then(() => {});
    return json({ ...base, template });
  }

  const templates = (await loadPublishedTemplates(db, portal.companyId)).filter(isFillable);
  return json({ ...base, templates });
});
