"use client";

import { useEffect, useState } from "react";

interface ProviderStatus {
  connected: boolean;
  reason?: string;
  configured?: boolean;
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

interface OAuthCallbackResult {
  status: "connected" | "error";
  message?: string;
}

// Reads the Mercado Libre OAuth callback's one-shot query params
// (?ml_status=connected|error&ml_message=...) synchronously on first render,
// via useState's lazy initializer — not inside an effect — so this is state
// derived once from the URL, not a setState call triggered by an effect.
function readOAuthResultFromUrl(): OAuthCallbackResult | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const status = params.get("ml_status");
  if (status !== "connected" && status !== "error") return null;
  return { status, message: params.get("ml_message") ?? undefined };
}

export default function MarketplaceIntelligence() {
  const [statuses, setStatuses] = useState<Record<string, ProviderStatus>>({});
  const [oauthResult] = useState<OAuthCallbackResult | null>(readOAuthResultFromUrl);

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

  // Side effects only (logging + cleaning the URL) — the redirect itself is
  // never silent: a failure is both logged here and shown in the banner
  // below via `oauthResult`, instead of disappearing into a plain redirect.
  useEffect(() => {
    if (!oauthResult) return;
    if (oauthResult.status === "error") {
      console.error(`[ML OAuth] connection failed: ${oauthResult.message ?? "unknown error"}`);
    }
    const params = new URLSearchParams(window.location.search);
    params.delete("ml_status");
    params.delete("ml_message");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [oauthResult]);

  return (
    <section className="mt-16">
      <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-slate-500">
        Marketplace Intelligence
      </h2>
      <p className="mx-auto mt-2 max-w-md text-center text-sm text-slate-600 dark:text-slate-400">
        Powered by official marketplace APIs — status below reflects live credentials.
      </p>
      {oauthResult && (
        <div
          className={`mx-auto mt-4 max-w-md rounded-lg border px-4 py-2 text-center text-sm ${
            oauthResult.status === "connected"
              ? "border-primary/30 bg-primary/10 text-primary-dark dark:text-secondary"
              : "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
          }`}
        >
          {oauthResult.status === "connected"
            ? "Mercado Libre connected successfully."
            : `Mercado Libre connection failed: ${oauthResult.message ?? "unknown error"}`}
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {TILES.map((tile) => {
          const status = statuses[tile.id];
          const connected = status?.connected ?? false;
          // `configured` defaults to `connected` when a provider doesn't
          // report it — a connected provider must be configured, and absent
          // other information that's the safest guess for a disconnected one.
          const configured = status?.configured ?? connected;
          const label = connected ? "Connected" : configured ? "Not connected" : "Not configured";
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
