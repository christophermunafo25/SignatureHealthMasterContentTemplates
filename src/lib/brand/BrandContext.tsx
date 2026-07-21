import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { BrandAsset, BrandKit } from "../types";
import { stores } from "../stores";
import { useAuth } from "../auth/AuthContext";
import { applyBrandTheme } from "../theme";
import { loadBrandFonts } from "../render/fonts";

/** Loads the active company's brand kit and assets; applies the
 * CSS-variable theme and loads brand fonts. Everything brand-aware (renderer,
 * builder, studio, chrome) reads from here. */
interface BrandState {
  loading: boolean;
  kit: BrandKit | null;
  assets: BrandAsset[];
  primaryLogoUrl: string | null;
  refresh(): Promise<void>;
}

const BrandContext = createContext<BrandState | null>(null);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [assets, setAssets] = useState<BrandAsset[]>([]);

  const refresh = useCallback(async () => {
    if (!company) {
      setKit(null);
      setAssets([]);
      applyBrandTheme(null);
      return;
    }
    const [nextKit, nextAssets] = await Promise.all([
      stores.brandKits.getActive(company.id),
      stores.brandAssets.list(company.id),
    ]);
    setKit(nextKit);
    setAssets(nextAssets);
    applyBrandTheme(nextKit);
    if (nextKit) {
      await loadBrandFonts(
        nextKit,
        nextAssets.filter((a) => a.kind === "font"),
      );
    }
  }, [company]);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch((e) => console.error("Brand load failed", e))
      .finally(() => setLoading(false));
  }, [refresh]);

  const primaryLogoUrl = useMemo(() => {
    const primary = assets.find((a) => a.id === kit?.primaryLogoAssetId);
    return (primary ?? assets.find((a) => a.kind === "logo"))?.url ?? null;
  }, [assets, kit]);

  const value = useMemo<BrandState>(
    () => ({ loading, kit, assets, primaryLogoUrl, refresh }),
    [loading, kit, assets, primaryLogoUrl, refresh],
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandState {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error("useBrand must be used inside BrandProvider");
  return ctx;
}
