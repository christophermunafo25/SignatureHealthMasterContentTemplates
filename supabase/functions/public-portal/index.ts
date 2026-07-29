// Anonymous facility portal reads. Verified by facility-link token, not by
// JWT (verify_jwt = false). Anonymous clients never talk to Postgres — this
// function reads with the service role, scoped by the token's company.
//
// POST { token, templateId? }
//   → without templateId: { facility, company, brandKit, logoUrl, brandAssets, templates }
//   → with templateId:    { facility, company, brandKit, logoUrl, brandAssets, template }
// Unknown / inactive / expired tokens → 404, never 403 (don't leak whether a
// token ever existed).

import { handleOptions, json, serviceClient } from "../_shared/figma.ts";
import { linkNotFound, rateLimitPublic, requireFacilityLink } from "../_shared/publicAuth.ts";
import { loadBrandKit, loadPublishedTemplates, toTemplate } from "../_shared/portalData.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { token?: unknown; templateId?: unknown };
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

  const link = await requireFacilityLink(db, token);
  if (!link) return linkNotFound();

  // Fire-and-forget bookkeeping; a failed update must not fail the read.
  void db
    .from("facility_links")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", link.id)
    .then(() => {});

  const { data: companyRow } = await db
    .from("companies")
    .select("name")
    .eq("id", link.company_id)
    .maybeSingle();
  const { brandKit, logoUrl, brandAssets } = await loadBrandKit(db, link.company_id);

  const base = {
    facility: { name: link.facility_name },
    company: { name: (companyRow as { name: string } | null)?.name ?? "" },
    brandKit,
    logoUrl,
    brandAssets,
  };

  if (typeof body.templateId === "string" && body.templateId) {
    const { data: row } = await db
      .from("templates")
      .select("*, template_fields(*)")
      .eq("id", body.templateId)
      .eq("company_id", link.company_id) // never serve another tenant's template
      .eq("status", "published")
      .maybeSingle();
    if (!row) return json({ error: "Template not found" }, 404);
    const template = toTemplate(row);
    if (link.template_tags.length && !template.tags.some((t: string) => link.template_tags.includes(t))) {
      return json({ error: "Template not found" }, 404);
    }
    // Anonymous open event, attributed to the facility so Insights keeps
    // working for anonymous traffic.
    void db
      .from("usage_events")
      .insert({
        company_id: link.company_id,
        template_id: template.id,
        action: "open",
        user_id: null,
        facility_link_id: link.id,
      })
      .then(() => {});
    return json({ ...base, template });
  }

  const templates = await loadPublishedTemplates(db, link.company_id, link.template_tags);
  return json({ ...base, templates });
});
