"use client";

import { useEffect, useState } from "react";

interface ProviderStatus {
  connected: boolean;
  reason?: string;
}

interface Tile {
  id: string;
  name: string;
  icon: string;
  note?: string;
}

// Real, official providers only — no SerpAPI tile. Ids match the provider
// `id` fields registered in src/lib/marketplace/registry.ts, plus "keepa"
// (historical enrichment only, added separately by /api/marketplace/status).
const TILES: Tile[] = [
  { id: "amazon-paapi", name: "Amazon", icon: "📦" },
  { id: "ebay-direct", name: "eBay", icon: "🏷️" },
  { id: "mercadolibre", name: "Mercado Libre", icon: "🛒" },
  { id: "walmart", name: "Walmart", icon: "🏬" },
  { id: "keepa", name: "Keepa", icon: "📈", note: "Historical enrichment only" },
];

export default function MarketplaceIntelligence() {
  const [statuses, setStatuses] = useState<Record<string, ProviderStatus>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/marketplace/status")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setStatuses(data.providers ?? {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mt-16">
      <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-slate-500">
        Marketplace Intelligence
      </h2>
      <p className="mx-auto mt-2 max-w-md text-center text-sm text-slate-600 dark:text-slate-400">
        Powered by official marketplace APIs — status below reflects live credentials.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {TILES.map((tile) => {
          const connected = statuses[tile.id]?.connected ?? false;
          const label = connected ? "Connected" : "Not configured";
          const statusClass = connected
            ? "text-primary-dark dark:text-secondary"
            : "text-slate-400 dark:text-slate-600";
          return (
            <div
              key={tile.id}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <span>{tile.icon}</span>
              <div>
                <div className="font-semibold text-dark dark:text-slate-100">{tile.name}</div>
                <div className={`text-xs ${statusClass}`}>{tile.note ? `${label} · ${tile.note}` : label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
