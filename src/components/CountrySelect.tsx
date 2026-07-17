"use client";

import { MERCADO_LIBRE_COUNTRIES } from "@/lib/marketplace";
import { useMarketplaceCountry } from "./MarketplaceCountryContext";

export default function CountrySelect() {
  const { country, setCountry } = useMarketplaceCountry();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-slate-500 sm:inline">Mercado Libre:</span>
      <select
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm outline-none transition-colors hover:border-orange-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        aria-label="Mercado Libre marketplace country"
      >
        {MERCADO_LIBRE_COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.label} ({c.currency})
          </option>
        ))}
      </select>
    </label>
  );
}
