// Tiny localStorage-backed document store for the zero-backend dev mode.
// Selected automatically when VITE_SUPABASE_URL is unset — same interfaces,
// same UI code paths as the Supabase backend.

interface Db {
  companies: unknown[];
  brandKits: unknown[];
  brandAssets: unknown[];
  locations: unknown[];
  templates: unknown[];
  usageEvents: unknown[];
}

const KEY = "brand-portal-dev-db";

const empty = (): Db => ({
  companies: [],
  brandKits: [],
  brandAssets: [],
  locations: [],
  templates: [],
  usageEvents: [],
});

export function readDb(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...(JSON.parse(raw) as Db) } : empty();
  } catch {
    return empty();
  }
}

export function writeDb(db: Db): void {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function mutate<T>(fn: (db: Db) => T): T {
  const db = readDb();
  const result = fn(db);
  writeDb(db);
  return result;
}

export const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const fileToDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
