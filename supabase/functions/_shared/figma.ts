// Shared helpers for the Figma Edge Functions. Runs in Deno (Supabase Edge).
// Tokens live ONLY here (integration_connections via service role) — the
// browser client never talks to Figma directly.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function handleOptions(req: Request): Response | null {
  return req.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : null;
}

/** Service-role client — bypasses RLS; only ever used server-side. */
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function getFigmaToken(db: SupabaseClient, companyId: string): Promise<string | null> {
  const { data } = await db
    .from("integration_connections")
    .select("access_token")
    .eq("company_id", companyId)
    .eq("provider", "figma")
    .maybeSingle();
  return (data as { access_token: string } | null)?.access_token ?? null;
}

export async function figmaGet(path: string, token: string): Promise<Response> {
  return fetch(`https://api.figma.com${path}`, { headers: { "X-Figma-Token": token } });
}

/** Parse a Figma file/design URL into { fileKey, nodeId }. */
export function parseFigmaUrl(url: string): { fileKey: string; nodeId: string } | null {
  const m = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)[^?]*\?(?:.*&)?node-id=([^&]+)/);
  if (!m) return null;
  // URL node ids use "12-34"; the API wants "12:34".
  return { fileKey: m[1], nodeId: decodeURIComponent(m[2]).replace(/-/g, ":") };
}
