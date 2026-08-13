// Token validation and rate limiting for the anonymous facility endpoints
// (public-portal, public-upload, submit-content). One SHARED portal token
// per company (companies.portal_token), with a rotation grace period: the
// previous token keeps working until portal_token_previous_expires so 69
// facilities aren't cut off the moment an admin rotates. portal_enabled is
// the separate kill switch.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { json } from "./figma.ts";

export interface PortalCompany {
  companyId: string;
  companyName: string;
  /** Matched on the PREVIOUS token — client shows a quiet replace banner. */
  tokenStale: boolean;
}

/** The uniform public-facing failure: a 404 that does not reveal whether the
 * token ever existed, is disabled, or expired. */
export function linkNotFound(): Response {
  return json({ error: "This link isn't active." }, 404);
}

/** Reserved ref for the root-URL public portal. Real tokens are 16+ chars,
 * so this can never collide with one. */
export const HOME_TOKEN = "~home";

/** Resolve a portal token to its company. The HOME_TOKEN sentinel resolves
 * to the single company that opted into the root-URL public portal
 * (portal_public), still behind the portal_enabled kill switch. Otherwise:
 * current token first, then the previous token while inside the rotation
 * grace window. Every other case is null (callers respond with
 * linkNotFound()). */
export async function requirePortalCompany(
  db: SupabaseClient,
  token: unknown,
): Promise<PortalCompany | null> {
  if (token === HOME_TOKEN) {
    const { data } = await db
      .from("companies")
      .select("id, name")
      .eq("portal_public", true)
      .eq("portal_enabled", true);
    // Exactly one opted-in company or nothing — two public tenants on one
    // deployment would make the root portal ambiguous.
    if (!data || data.length !== 1) return null;
    return { companyId: data[0].id, companyName: data[0].name, tokenStale: false };
  }
  if (typeof token !== "string" || token.length < 16 || token.length > 128) return null;

  const { data: current } = await db
    .from("companies")
    .select("id, name, portal_enabled")
    .eq("portal_token", token)
    .maybeSingle();
  if (current) {
    if (!(current as { portal_enabled: boolean }).portal_enabled) return null;
    const c = current as { id: string; name: string };
    return { companyId: c.id, companyName: c.name, tokenStale: false };
  }

  const { data: prev } = await db
    .from("companies")
    .select("id, name, portal_enabled, portal_token_previous_expires")
    .eq("portal_token_previous", token)
    .maybeSingle();
  if (!prev) return null;
  const p = prev as {
    id: string;
    name: string;
    portal_enabled: boolean;
    portal_token_previous_expires: string | null;
  };
  if (!p.portal_enabled) return null;
  if (!p.portal_token_previous_expires || new Date(p.portal_token_previous_expires).getTime() < Date.now()) {
    return null;
  }
  return { companyId: p.id, companyName: p.name, tokenStale: true };
}

export interface FacilityRow {
  id: string;
  company_id: string;
  name: string;
  short_name: string;
  state: string | null;
  active: boolean;
  logo_storage_path: string | null;
}

/** Verify a facilityId belongs to the portal's company and is active. */
export async function requireFacility(
  db: SupabaseClient,
  companyId: string,
  facilityId: unknown,
): Promise<FacilityRow | null> {
  if (typeof facilityId !== "string" || !facilityId) return null;
  const { data } = await db
    .from("facilities")
    .select("id, company_id, name, short_name, state, active, logo_storage_path")
    .eq("id", facilityId)
    .eq("company_id", companyId)
    .maybeSingle();
  const f = data as FacilityRow | null;
  return f && f.active ? f : null;
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
  perToken = 600,
  perIp = 120,
): Promise<boolean> {
  const [tokenOk, ipOk] = await Promise.all([
    rateLimit(db, `${fn}:t:${token}`, perToken, 60),
    rateLimit(db, `${fn}:ip:${clientIp(req)}`, perIp, 60),
  ]);
  return tokenOk && ipOk;
}
