// Signed-upload issuance for anonymous facility clients. Storage RLS gives
// anon no write path; this function scopes a short-lived signed upload URL
// to a single fresh path under the link's company prefix in the PRIVATE
// submissions bucket.
//
// POST { token, contentType, fileName? } → { path, signedUrl, uploadToken }

import { handleOptions, json, serviceClient } from "../_shared/figma.ts";
import { linkNotFound, rateLimitPublic, requirePortalCompany } from "../_shared/publicAuth.ts";
import { ALLOWED_UPLOAD_MIME } from "../_shared/releaseForm.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { token?: unknown; contentType?: unknown; fileName?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const db = serviceClient();
  const token = typeof body.token === "string" ? body.token : "";
  // v2.2: a release-form submission can carry 10 files plus retries, so the
  // ceiling sits well above the old preview-only traffic.
  if (!(await rateLimitPublic(db, "upload", req, token, 600, 100))) {
    return json({ error: "Too many requests" }, 429);
  }

  const portal = await requirePortalCompany(db, token);
  if (!portal) return linkNotFound();

  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  const ext = ALLOWED_UPLOAD_MIME[contentType];
  if (!ext) return json({ error: "Unsupported file type" }, 400);

  // Never put user-supplied filenames in the path; the display name rides in
  // the submission's asset_paths[].name.
  const path = `${portal.companyId}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await db.storage.from("submissions").createSignedUploadUrl(path);
  if (error || !data) {
    console.error("createSignedUploadUrl failed", error);
    return json({ error: "Upload unavailable" }, 500);
  }
  return json({ path, signedUrl: data.signedUrl, uploadToken: data.token });
});
