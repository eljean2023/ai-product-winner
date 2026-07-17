"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "connected" | "not-connected";

export default function MarketplaceStatusBar() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/marketplace/status")
      .then((res) => res.json())
      .then((data: { mercadolibre?: boolean }) => {
        if (!cancelled) setStatus(data.mercadolibre ? "connected" : "not-connected");
      })
      .catch(() => {
        if (!cancelled) setStatus("not-connected");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mb-6 flex flex-wrap gap-2 text-xs">
      <div
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
          status === "connected"
            ? "border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-500/10"
            : "border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50"
        }`}
      >
        <span>🛒</span>
        <span
          className={
            status === "connected"
              ? "font-semibold text-dark dark:text-slate-100"
              : "font-semibold text-slate-600 dark:text-slate-400"
          }
        >
          Mercado Libre
        </span>
        <span className={status === "connected" ? "text-primary-dark dark:text-secondary" : "text-slate-400 dark:text-slate-600"}>
          {status === "checking" ? "Checking..." : status === "connected" ? "✓ Connected" : "Not Connected"}
        </span>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/50">
        <span>📦</span>
        <span className="font-semibold text-slate-600 dark:text-slate-400">Amazon</span>
        <span className="text-slate-400 dark:text-slate-600">Coming Soon</span>
      </div>
    </div>
  );
}
