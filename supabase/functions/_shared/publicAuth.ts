// Token validation and rate limiting for the anonymous facility endpoints
// (public-portal, public-upload, submit-content). Mirrors requireRole's
// role in the authenticated functions: every public function calls
// requireFacilityLink() before doing anything else.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { json } from "./figma.ts";

export interface FacilityLinkRow {
  id: string;
  company_id: string;
  token: string;
  facility_name: string;
  template_tags: string[];
  active: boolean;
  expires_at: string | null;
}

/** The uniform public-facing failure: a 404 that does not reveal whether the
 * token ever existed, is inactive, or expired. */
export function linkNotFound(): Response {
  return json({ error: "This link isn't active." }, 404);
}

/** Validate a facility link token. Returns the row only when the link is
 * known, active, and unexpired — every other case is null (callers respond
 * with linkNotFound()). */
export async function requireFacilityLink(
  db: SupabaseClient,
  token: unknown,
): Promise<FacilityLinkRow | null> {
  if (typeof token !== "string" || token.length < 16 || token.length > 128) return null;
  const { data } = await db
    .from("facility_links")
    .select("id, company_id, token, facility_name, template_tags, active, expires_at")
    .eq("token", token)
    .maybeSingle();
  const link = data as FacilityLinkRow | null;
  if (!link || !link.active) return null;
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) return null;
  return link;
}

/** Fixed-window rate limiter backed by the rate_limits table. Returns true
 * when the request is allowed. Fail-open: a rate-limit storage error must
 * not take the public portal down with it. */
export async function rateLimit(
  db: SupabaseClient,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const now = Date.now();
    const { data } = await db
      .from("rate_limits")
      .select("window_start, count")
      .eq("bucket", bucket)
      .maybeSingle();
    const row = data as { window_start: string; count: number } | null;
    const windowExpired = !row || now - new Date(row.window_start).getTime() > windowSeconds * 1000;
    if (windowExpired) {
      await db
        .from("rate_limits")
        .upsert({ bucket, window_start: new Date(now).toISOString(), count: 1 });
      return true;
    }
    if (row!.count >= limit) return false;
    await db.from("rate_limits").update({ count: row!.count + 1 }).eq("bucket", bucket);
    return true;
  } catch (e) {
    console.warn("rate_limits unavailable, allowing request", e);
    return true;
  }
}

/** Client IP for per-IP buckets (best effort behind the platform proxy). */
export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
}

/** Both buckets must pass: per-token and per-IP. */
export async function rateLimitPublic(
  db: SupabaseClient,
  fn: string,
  req: Request,
  token: string,
  perToken = 240,
  perIp = 120,
): Promise<boolean> {
  const [tokenOk, ipOk] = await Promise.all([
    rateLimit(db, `${fn}:t:${token}`, perToken, 60),
    rateLimit(db, `${fn}:ip:${clientIp(req)}`, perIp, 60),
  ]);
  return tokenOk && ipOk;
}
