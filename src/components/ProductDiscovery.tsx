"use client";

import { useState, type FormEvent } from "react";
import { discoverOpportunities, type ProductOpportunity } from "@/lib/engine";
import { useMarketplaceCountry } from "./MarketplaceCountryContext";
import { RECOMMENDATION_STYLES } from "./recommendationStyles";

const EXAMPLES = [
  "I have $500",
  "Easy to ship",
  "High margin",
  "Trending kitchen products",
  "Small products",
  "Gaming",
  "Pet",
  "Beauty",
];

const IDK_EXAMPLE = "I don't know what to sell";

interface ProductDiscoveryProps {
  onAnalyze: (productName: string) => void;
}

export default function ProductDiscovery({ onAnalyze }: ProductDiscoveryProps) {
  const { country } = useMarketplaceCountry();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductOpportunity[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchedFor, setSearchedFor] = useState("");

  async function runDiscovery(term: string) {
    setIsSearching(true);
    setResults(null);

    try {
      const opportunities = await discoverOpportunities(term, 5, { country });
      setResults(opportunities);
      setSearchedFor(term.trim());
    } finally {
      setIsSearching(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void runDiscovery(query);
  }

  function handleExampleClick(example: string) {
    setQuery(example);
    void runDiscovery(example);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={'e.g. "I have $500", "high margin", "trending kitchen products"...'}
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-dark placeholder:text-slate-400 outline-none ring-orange-500/40 focus:border-orange-500 focus:ring-4 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
        />
        <button
          type="submit"
          disabled={isSearching}
          className="rounded-xl bg-gradient-to-r from-primary to-secondary px-6 py-3 text-base font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSearching ? "Searching..." : "Find Opportunities"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Try:</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => handleExampleClick(example)}
            className="rounded-full border border-slate-300 px-3 py-1 text-slate-700 transition-colors hover:border-orange-400 hover:text-primary-dark dark:border-slate-700 dark:text-slate-300 dark:hover:border-orange-500 dark:hover:text-secondary"
          >
            {example}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleExampleClick(IDK_EXAMPLE)}
          className="rounded-full border border-dashed border-slate-300 px-3 py-1 italic text-slate-700 transition-colors hover:border-orange-400 hover:text-primary-dark dark:border-slate-700 dark:text-slate-300 dark:hover:border-orange-500 dark:hover:text-secondary"
        >
          {IDK_EXAMPLE}
        </button>
      </div>

      {isSearching && (
        <div className="mt-12 flex flex-col items-center gap-3 text-slate-500">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-primary" />
          <p className="text-sm">Scanning marketplaces for opportunities...</p>
        </div>
      )}

      {results && !isSearching && (
        <section className="mt-10">
          <h2 className="text-lg font-bold text-dark dark:text-slate-50">
            Top Product Opportunities
            {searchedFor ? ` for "${searchedFor}"` : ""}
          </h2>

          <div className="mt-4 space-y-4">
            {results.map((opp, index) => {
              const styles = RECOMMENDATION_STYLES[opp.recommendation];
              return (
                <div
                  key={opp.productName}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      {opp.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- external marketplace image, not a local asset
                        <img
                          src={opp.imageUrl}
                          alt={opp.productName}
                          className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-800"
                        />
                      )}
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {index + 1}. {opp.category}
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-dark dark:text-slate-50">
                          {opp.productName}
                        </h3>
                        <span
                          className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${styles.badge}`}
                        >
                          {opp.recommendation}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-center">
                      <span className={`text-2xl font-bold ${styles.text}`}>
                        {opp.opportunityScore}
                      </span>
                      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        Score
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                    {opp.shortExplanation}
                  </p>
                  {!opp.shortExplanation.includes("$") && (
                    <p className="mt-1 text-xs text-slate-500">
                      {opp.dataConfidence === "hybrid" ? "Current" : "Typical"} price range: {opp.priceMin} - {opp.priceMax} {opp.priceCurrency}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {opp.marketplaceData.map((summary) => (
                      <span
                        key={summary.marketplace}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          summary.available
                            ? "bg-orange-50 text-primary-dark dark:bg-orange-500/10 dark:text-secondary"
                            : "bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600"
                        }`}
                      >
                        {summary.marketplaceName}
                        {summary.available
                          ? ` · ${summary.listingCount} listings`
                          : " · Not Connected"}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">
                        Demand
                      </div>
                      <div className="text-sm font-semibold text-dark dark:text-slate-100">
                        {opp.demand}/100
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">
                        Competition
                      </div>
                      <div className="text-sm font-semibold text-dark dark:text-slate-100">
                        {opp.competition}/100
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">
                        Margin
                      </div>
                      <div className="text-sm font-semibold text-dark dark:text-slate-100">
                        {opp.marginPotential}/100
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onAnalyze(opp.productName)}
                    className="mt-4 text-sm font-semibold text-primary-dark hover:underline dark:text-secondary"
                  >
                    Analyze this product →
                  </button>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-xs text-slate-500">
            <span className="font-semibold text-slate-600 dark:text-slate-400">
              AI + Marketplace Estimate —
            </span>{" "}
            Ranked using category heuristics blended with live marketplace listings where available.
          </p>
        </section>
      )}
    </div>
  );
}
