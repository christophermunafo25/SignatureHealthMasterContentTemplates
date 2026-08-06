// Transactional email. Provider (Resend) stays behind sendNotification()
// so swapping to Postmark/SendGrid is a one-file change. Secrets:
//   RESEND_API_KEY            — set via `supabase secrets set`
//   NOTIFICATION_FROM_EMAIL   — e.g. content@mail.<sending-domain>
//   PUBLIC_APP_URL            — deployed origin, for review deep links
//
// NOTE FOR ROLLOUT: the sending domain needs SPF and DKIM records on the
// client's side or notifications land in spam. Raise this with Signature IT
// at the START of the notification phase, not on launch day.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { ReleaseForm } from "./releaseForm.ts";

const BRAND_NAVY = "#003B71";
const BRAND_CREAM = "#F1E4B2";

/** Send an email through the configured provider. Resolves false (never
 * throws) when the provider is unconfigured or rejects — callers must treat
 * email as best-effort. */
export async function sendNotification(
  to: string[],
  subject: string,
  html: string,
): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("NOTIFICATION_FROM_EMAIL");
  if (!apiKey || !from || to.length === 0) {
    console.warn("email skipped: provider not configured or no recipients");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      console.error("email send failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("email send failed", e);
    return false;
  }
}

interface SubmissionEmailParams {
  companyId: string;
  submissionId: string;
  kind: "template" | "direct";
  facilityName: string;
  templateName: string;
  submitterName: string;
  submitterEmail: string | null;
  caption: string;
  previewPath: string | null;
  releaseForm: ReleaseForm | null;
  assetCount: number;
  releaseFlagged: boolean;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Team notification + optional submitter confirmation for one submission.
 * Recipients come from companies.notification_emails (configuration, not a
 * constant — hardcoding a client's address into a multi-tenant product is a
 * bug waiting for the second tenant). */
export async function sendSubmissionNotification(
  db: SupabaseClient,
  p: SubmissionEmailParams,
): Promise<void> {
  const { data: company } = await db
    .from("companies")
    .select("name, notification_emails")
    .eq("id", p.companyId)
    .maybeSingle();
  const recipients: string[] =
    (company as { notification_emails: string[] } | null)?.notification_emails ?? [];
  const companyName = (company as { name: string } | null)?.name ?? "your team";

  // The preview lives in the PRIVATE submissions bucket — email clients need
  // a long-lived signed URL (the social team may open this days later).
  let previewUrl: string | null = null;
  if (p.previewPath) {
    const { data } = await db.storage
      .from("submissions")
      .createSignedUrl(p.previewPath, 60 * 60 * 24 * 30); // 30 days
    previewUrl = data?.signedUrl ?? null;
  }

  const appUrl = (Deno.env.get("PUBLIC_APP_URL") ?? "").replace(/\/$/, "");
  const reviewUrl = appUrl ? `${appUrl}/submissions/${p.submissionId}` : null;
  const submittedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  // v2.2: the release answers ride the team email so triage can happen from
  // the inbox. The flag line goes FIRST — it's the one thing that changes
  // how the reviewer treats the submission.
  const rf = p.releaseForm;
  const releaseRows = rf
    ? `
      <tr><td style="color: #777; padding-right: 14px;">Platforms</td><td>${esc((rf.platforms ?? []).join(", ") || "—")}</td></tr>
      <tr><td style="color: #777; padding-right: 14px;">Requested post</td><td>${esc(rf.requestedPostDate || "—")}${rf.requestedPostTime ? ` at ${esc(rf.requestedPostTime)}` : ""}</td></tr>
      <tr><td style="color: #777; padding-right: 14px;">VP approved</td><td>${esc(rf.vpApproved ?? "—")}</td></tr>
      <tr><td style="color: #777; padding-right: 14px;">Photo release</td><td>${esc(rf.photoRelease ?? "—")}</td></tr>
      <tr><td style="color: #777; padding-right: 14px;">Minor release</td><td>${esc(rf.minorRelease ?? "—")}</td></tr>
      <tr><td style="color: #777; padding-right: 14px;">Off-campus release</td><td>${esc(rf.offCampusRelease ?? "—")}</td></tr>
      <tr><td style="color: #777; padding-right: 14px;">Files</td><td>${p.assetCount}</td></tr>`
    : "";

  // Plain and legible: a work notification in a busy inbox — restraint
  // beats art direction.
  const html = `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: ${BRAND_NAVY}; color: ${BRAND_CREAM}; padding: 16px 20px; border-radius: 8px 8px 0 0;">
    <p style="margin: 0; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">${esc(companyName)}</p>
    <h1 style="margin: 4px 0 0; font-size: 18px; color: #ffffff;">New content from ${esc(p.facilityName)}</h1>
  </div>
  <div style="border: 1px solid #e2e2e2; border-top: none; border-radius: 0 0 8px 8px; padding: 20px;">
    ${p.releaseFlagged ? `<p style="font-size: 14px; font-weight: bold; color: #c62f24; margin: 0 0 14px;">Needs a look: VP of Operations did not approve this event.</p>` : ""}
    ${previewUrl ? `<img src="${previewUrl}" alt="Submitted graphic preview" style="width: 100%; max-width: 420px; display: block; margin: 0 auto 16px; border-radius: 6px; border: 1px solid #e2e2e2;" />` : ""}
    <table style="font-size: 14px; line-height: 1.7; border-collapse: collapse;">
      <tr><td style="color: #777; padding-right: 14px;">Facility</td><td>${esc(p.facilityName)}</td></tr>
      <tr><td style="color: #777; padding-right: 14px;">${p.kind === "direct" ? "Type" : "Template"}</td><td>${p.kind === "direct" ? "Direct upload" : esc(p.templateName)}</td></tr>
      <tr><td style="color: #777; padding-right: 14px;">Submitted by</td><td>${esc(p.submitterName)}</td></tr>
      <tr><td style="color: #777; padding-right: 14px;">Submitted</td><td>${submittedAt} ET</td></tr>${releaseRows}
    </table>
    ${p.caption ? `
    <p style="font-size: 12px; color: #777; margin: 16px 0 4px; text-transform: uppercase; letter-spacing: 1px;">Caption</p>
    <p style="font-size: 14px; line-height: 1.6; background: #f7f5ee; padding: 12px 14px; border-radius: 6px; margin: 0; white-space: pre-wrap;">${esc(p.caption)}</p>` : ""}
    ${reviewUrl ? `
    <p style="text-align: center; margin: 22px 0 6px;">
      <a href="${reviewUrl}" style="background: ${BRAND_NAVY}; color: #ffffff; text-decoration: none; padding: 12px 26px; border-radius: 6px; font-size: 14px; display: inline-block;">Review &amp; download</a>
    </p>` : ""}
  </div>
</div>`;

  await sendNotification(
    recipients,
    p.kind === "direct"
      ? `New content submission — ${p.facilityName}`
      : `New content from ${p.facilityName}: ${p.templateName}`,
    html,
  );

  if (p.submitterEmail) {
    const what =
      p.kind === "direct" ? "submission" : `"${esc(p.templateName)}" graphic`;
    const requestedLine =
      rf?.requestedPostDate
        ? `<p style="font-size: 14px; line-height: 1.6;">You asked for it to go up on <b>${esc(rf.requestedPostDate)}</b>${rf.requestedPostTime ? ` at <b>${esc(rf.requestedPostTime)}</b>` : ""}.</p>`
        : "";
    const confirmHtml = `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
  <h1 style="font-size: 17px; color: ${BRAND_NAVY};">Thanks, ${esc(p.submitterName)} — your ${p.kind === "direct" ? "content" : "graphic"} is in review</h1>
  <p style="font-size: 14px; line-height: 1.6;">
    Your ${what} from ${esc(p.facilityName)} was sent to the
    ${esc(companyName)} social team. They'll review it and post it on the brand's
    channels — no further action needed on your end.
  </p>
  ${requestedLine}
  ${previewUrl ? `<img src="${previewUrl}" alt="Your submitted graphic" style="width: 100%; max-width: 380px; display: block; border-radius: 6px; border: 1px solid #e2e2e2;" />` : ""}
</div>`;
    await sendNotification(
      [p.submitterEmail],
      p.kind === "direct"
        ? "Your content submission is in review"
        : `Your ${p.templateName} graphic is in review`,
      confirmHtml,
    );
  }
}
