// Data access for the anonymous facility portal. NEVER touches Postgres or
// the Supabase client session: production traffic goes through the
// public-portal Edge Function (token-verified, service role server-side);
// the dev backend resolves the same shapes from localStorage so the whole
// facility flow is demoable without standing up Supabase.

import type { BrandAsset, BrandKit, FacilityLink, TemplateSchema } from "./types";
import { isSupabaseConfigured } from "./stores/supabase/client";
import { readDb } from "./stores/local/db";

export interface PublicPortalData {
  facility: { name: string };
  company: { name: string };
  brandKit: BrandKit | null;
  logoUrl: string | null;
  brandAssets: BrandAsset[];
  templates?: TemplateSchema[];
  template?: TemplateSchema;
}

/** The uniform "no such link" outcome — unknown, inactive, and expired
 * tokens are indistinguishable on purpose. */
export class LinkInactiveError extends Error {
  constructor() {
    super("This link isn't active.");
    this.name = "LinkInactiveError";
  }
}

export async function fetchPublicPortal(token: string, templateId?: string): Promise<PublicPortalData> {
  return isSupabaseConfigured ? fetchRemote(token, templateId) : fetchLocal(token, templateId);
}

async function fetchRemote(token: string, templateId?: string): Promise<PublicPortalData> {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const res = await fetch(`${base}/functions/v1/public-portal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ token, templateId }),
  });
  if (res.status === 404) throw new LinkInactiveError();
  if (!res.ok) throw new Error(`Portal request failed (${res.status})`);
  return (await res.json()) as PublicPortalData;
}

/** Dev backend: same validation rules as the Edge Function, against the
 * localStorage document store. */
async function fetchLocal(token: string, templateId?: string): Promise<PublicPortalData> {
  const db = readDb();
  const link = (db.facilityLinks as FacilityLink[]).find((l) => l.token === token);
  if (!link || !link.active) throw new LinkInactiveError();
  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) throw new LinkInactiveError();

  const company = (db.companies as Array<{ id: string; name: string }>).find((c) => c.id === link.companyId);
  const kit =
    (db.brandKits as BrandKit[]).find((k) => k.companyId === link.companyId) ?? null;
  const assets = (db.brandAssets as BrandAsset[]).filter((a) => a.companyId === link.companyId);
  const logo = kit?.primaryLogoAssetId ? assets.find((a) => a.id === kit.primaryLogoAssetId) : null;

  let templates = (db.templates as TemplateSchema[]).filter(
    (t) => t.companyId === link.companyId && t.status === "published",
  );
  if (link.templateTags.length) {
    templates = templates.filter((t) => t.tags.some((tag) => link.templateTags.includes(tag)));
  }

  const base = {
    facility: { name: link.facilityName },
    company: { name: company?.name ?? "" },
    brandKit: kit ? { ...kit, typeStyles: kit.typeStyles ?? [], guidelines: [] } : null,
    logoUrl: logo?.url ?? null,
    brandAssets: assets,
  };

  if (templateId) {
    const template = templates.find((t) => t.id === templateId);
    if (!template) throw new Error("Template not found");
    return { ...base, template };
  }
  return { ...base, templates };
}
