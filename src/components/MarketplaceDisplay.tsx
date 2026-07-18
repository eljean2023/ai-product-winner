import type { MarketplaceSummary } from "@/lib/marketplace";

const MARKETPLACE_ICON: Record<string, string> = {
  mercadolibre: "🛒",
  amazon: "📦",
  ebay: "🏷️",
};

export function MarketplaceChip({ summary }: { summary: MarketplaceSummary }) {
  const icon = MARKETPLACE_ICON[summary.marketplace] ?? "🏬";

  if (!summary.available) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900/50">
        <span>{icon}</span>
        <div>
          <div className="font-semibold text-slate-600 dark:text-slate-400">{summary.marketplaceName}</div>
          <div className="text-slate-400 dark:text-slate-600">Not Connected</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs dark:border-orange-900/40 dark:bg-orange-500/10">
      <span>{icon}</span>
      <div>
        <div className="font-semibold text-dark dark:text-slate-100">{summary.marketplaceName}</div>
        <div className="text-slate-600 dark:text-slate-400">
          {summary.listingCount} listing{summary.listingCount === 1 ? "" : "s"}
          {summary.averagePrice !== undefined ? ` · avg ${summary.averagePrice} ${summary.currency ?? ""}` : ""}
        </div>
      </div>
    </div>
  );
}

export function MarketplaceButtons({ summaries }: { summaries: MarketplaceSummary[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {summaries.map((summary) => {
        const enabled = summary.available && Boolean(summary.topListing?.url);
        return (
          <a
            key={summary.marketplace}
            href={enabled ? summary.topListing!.url : undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (!enabled) e.preventDefault();
            }}
            aria-disabled={!enabled}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              enabled
                ? "bg-dark text-white hover:bg-slate-700"
                : "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600"
            }`}
          >
            View on {summary.marketplaceName}
          </a>
        );
      })}
    </div>
  );
}
