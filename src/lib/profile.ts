// Account profiles (Supabase backend only — the dev backend has no real
// accounts). The users row is the single source: first/last name, title,
// avatar. Written by the account-setup gate (invite arrivals) and the
// Edit-profile dialog; read into AuthState and the People page.

import { supabase } from "./stores/supabase/client";

export interface UserProfile {
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  avatarUrl: string | null;
}

export function profileDisplayName(profile: UserProfile | null | undefined, email: string): string {
  const full = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  // Fallback: derive something human from the address.
  return email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function profileInitials(profile: UserProfile | null | undefined, email: string): string {
  const parts = [profile?.firstName, profile?.lastName].filter((s): s is string => Boolean(s));
  if (parts.length > 0) return parts.slice(0, 2).map((s) => s[0]!.toUpperCase()).join("");
  return email
    .split(/[@\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

export async function loadOwnProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase()
    .from("users")
    .select("first_name, last_name, title, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as { first_name: string | null; last_name: string | null; title: string | null; avatar_url: string | null };
  return { firstName: r.first_name, lastName: r.last_name, title: r.title, avatarUrl: r.avatar_url };
}

export async function saveOwnProfile(
  userId: string,
  patch: { firstName: string; lastName: string; title: string; avatarUrl?: string },
): Promise<void> {
  const row: Record<string, string | null> = {
    first_name: patch.firstName.trim() || null,
    last_name: patch.lastName.trim() || null,
    title: patch.title.trim() || null,
  };
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
  const { error } = await supabase().from("users").update(row).eq("id", userId);
  if (error) throw error;
}

const AVATAR_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const AVATAR_MAX_BYTES = 4 * 1024 * 1024;

/** Upload a profile photo to the public avatars bucket (self-scoped path)
 * and return its public URL. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = AVATAR_TYPES[file.type];
  if (!ext) throw new Error("Use a PNG, JPEG, or WebP image.");
  if (file.size > AVATAR_MAX_BYTES) throw new Error("Keep the photo under 4 MB.");
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase().storage.from("avatars").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return supabase().storage.from("avatars").getPublicUrl(path).data.publicUrl;
}
