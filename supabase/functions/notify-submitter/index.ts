// Emails a submitter the decline reason. ADMIN-authenticated (JWT +
// requireRole) — never callable from the anonymous portal or the client
// with a bare token. Email remains best-effort; the decline itself is
// already saved by the time this runs.
//
// POST { submissionId, reason }  → { ok: true, sent: boolean }

import { handleOptions, json, requireRole, serviceClient } from "../_shared/figma.ts";
import { sendNotification } from "../_shared/email.ts";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { submissionId?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const submissionId = typeof body.submissionId === "string" ? body.submissionId : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 2000) : "";
  if (!submissionId || !reason) return json({ error: "submissionId and reason are required" }, 400);

  const db = serviceClient();
  const { data: sub } = await db
    .from("submissions")
    .select("company_id, facility_name, template_name, submitter_name, submitter_email")
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub) return json({ error: "Submission not found" }, 404);
  const s = sub as {
    company_id: string;
    facility_name: string;
    template_name: string;
    submitter_name: string;
    submitter_email: string | null;
  };

  const auth = await requireRole(req, s.company_id, "admin");
  if ("error" in auth) return json({ error: auth.error }, auth.status);

  if (!s.submitter_email) return json({ ok: true, sent: false });

  const { data: company } = await db
    .from("companies")
    .select("name")
    .eq("id", s.company_id)
    .maybeSingle();
  const companyName = (company as { name: string } | null)?.name ?? "the marketing team";

  const html = `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
  <h1 style="font-size: 17px; color: #003B71;">About your "${esc(s.template_name)}" graphic</h1>
  <p style="font-size: 14px; line-height: 1.6;">
    Hi ${esc(s.submitter_name)} — the ${esc(companyName)} social team reviewed the
    graphic you sent from ${esc(s.facility_name)} and can't post it as-is:
  </p>
  <p style="font-size: 14px; line-height: 1.6; background: #f5f6f8; padding: 12px 14px; border-radius: 6px; white-space: pre-wrap;">${esc(reason)}</p>
  <p style="font-size: 14px; line-height: 1.6;">
    You're welcome to submit a new version through the same portal link —
    it takes a minute, and the team will pick it up from there.
  </p>
</div>`;

  const sent = await sendNotification(
    [s.submitter_email],
    `About your ${s.template_name} submission`,
    html,
  );
  return json({ ok: true, sent });
});
