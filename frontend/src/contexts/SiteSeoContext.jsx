import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { cachedApiFetch } from "../lib/api.js";
import { sanitizePublicUrl } from "../lib/seo.js";

const SiteSeoContext = createContext(null);
const ENV_SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || "").replace(/\/$/, "");

function getDefaultSiteUrl() {
  const envSiteUrl = sanitizePublicUrl(ENV_SITE_URL);
  if (envSiteUrl) return envSiteUrl;

  if (typeof window === "undefined") {
    return "";
  }

  return sanitizePublicUrl(window.location.origin);
}

const fallbackValue = {
  site: {
    name: "ESADAR",
    description: "Ropa: sportswear, vintage y prendas modernas.",
    url: getDefaultSiteUrl(),
  },
  pages: [],
  pagesByRoute: {},
  loaded: false,
};

export function SiteSeoProvider({ children }) {
  const [value, setValue] = useState(fallbackValue);

  useEffect(() => {
    let ignore = false;

    async function loadSeoConfig() {
      try {
        const response = await cachedApiFetch("/api/public/seo/site", { ttlMs: 900000 });
        if (ignore) return;

        const pages = response.pages || [];
        setValue({
          site: response.site || fallbackValue.site,
          pages,
          pagesByRoute: Object.fromEntries(
            pages.map((page) => [page.route, page]),
          ),
          loaded: true,
        });
      } catch {
        if (ignore) return;
        setValue((current) => ({
          ...current,
          loaded: true,
        }));
      }
    }

    loadSeoConfig();
    return () => {
      ignore = true;
    };
  }, []);

  const memoizedValue = useMemo(() => value, [value]);
  return (
    <SiteSeoContext.Provider value={memoizedValue}>
      {children}
    </SiteSeoContext.Provider>
  );
}

export function useSiteSeo() {
  const context = useContext(SiteSeoContext);
  if (!context) {
    throw new Error("useSiteSeo must be used inside SiteSeoProvider");
  }
  return context;
}
