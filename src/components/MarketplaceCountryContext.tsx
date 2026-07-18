"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_ML_COUNTRY, MERCADO_LIBRE_COUNTRIES } from "@/lib/marketplace/countries";

const STORAGE_KEY = "aiph:ml-country";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): string {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored && MERCADO_LIBRE_COUNTRIES.some((c) => c.code === stored) ? stored : DEFAULT_ML_COUNTRY;
}

function getServerSnapshot(): string {
  return DEFAULT_ML_COUNTRY;
}

interface MarketplaceCountryContextValue {
  country: string;
  setCountry: (code: string) => void;
}

const MarketplaceCountryContext = createContext<MarketplaceCountryContextValue | null>(null);

export function MarketplaceCountryProvider({ children }: { children: ReactNode }) {
  // localStorage is an external system, so we sync it via
  // useSyncExternalStore rather than an effect + setState (which would
  // both be redundant here and mismatch during SSR hydration).
  const country = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setCountry = useCallback((code: string) => {
    window.localStorage.setItem(STORAGE_KEY, code);
    // The native "storage" event only fires in *other* tabs, so dispatch it
    // manually here to make this tab's own subscribers re-read the value.
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  }, []);

  return (
    <MarketplaceCountryContext.Provider value={{ country, setCountry }}>
      {children}
    </MarketplaceCountryContext.Provider>
  );
}

export function useMarketplaceCountry(): MarketplaceCountryContextValue {
  const ctx = useContext(MarketplaceCountryContext);
  if (!ctx) {
    throw new Error("useMarketplaceCountry must be used within a MarketplaceCountryProvider");
  }
  return ctx;
}
