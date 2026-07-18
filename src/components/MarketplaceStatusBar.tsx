"use client";

import { useEffect, useState } from "react";

type Status =
  | { state: "checking" }
  | { state: "connected"; account: string }
  | { state: "not-connected" };

export default function MarketplaceStatusBar() {
  const [status, setStatus] = useState<Status>({ state: "checking" });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/marketplace/status")
      .then((res) => res.json())
      .then((data: { mercadolibre?: { connected: boolean; account?: string } }) => {
        if (cancelled) return;
        if (data.mercadolibre?.connected) {
          setStatus({ state: "connected", account: data.mercadolibre.account ?? "Mercado Libre" });
        } else {
          setStatus({ state: "not-connected" });
        }
      })
      .catch(() => {
        if (!cancelled) setStatus({ state: "not-connected" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDisconnect() {
    setStatus({ state: "checking" });
    try {
      await fetch("/api/marketplace/mercadolibre/disconnect", { method: "POST" });
    } finally {
      setStatus({ state: "not-connected" });
    }
  }

  const connected = status.state === "connected";

  return (
    <div className="mb-6 flex flex-wrap gap-2 text-xs">
      <div
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
          connected
            ? "border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-500/10"
            : "border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50"
        }`}
      >
        <span>🛒</span>
        <span
          className={
            connected
              ? "font-semibold text-dark dark:text-slate-100"
              : "font-semibold text-slate-600 dark:text-slate-400"
          }
        >
          Mercado Libre
        </span>
        <span className={connected ? "text-primary-dark dark:text-secondary" : "text-slate-400 dark:text-slate-600"}>
          {status.state === "checking"
            ? "Checking..."
            : status.state === "connected"
              ? `✓ Connected as ${status.account}`
              : "Not Connected"}
        </span>
        {status.state === "not-connected" && (
          <a
            href="/api/marketplace/mercadolibre/connect"
            className="ml-1 rounded-lg bg-primary px-2 py-1 font-semibold text-white hover:opacity-90"
          >
            Connect
          </a>
        )}
        {connected && (
          <button
            type="button"
            onClick={handleDisconnect}
            className="ml-1 rounded-lg border border-slate-300 px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Disconnect
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/50">
        <span>📦</span>
        <span className="font-semibold text-slate-600 dark:text-slate-400">Amazon</span>
        <span className="text-slate-400 dark:text-slate-600">Coming Soon</span>
      </div>
    </div>
  );
}
