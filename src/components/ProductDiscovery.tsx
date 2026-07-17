"use client";

import { useState, type FormEvent } from "react";
import { discoverOpportunities, type ProductOpportunity } from "@/lib/engine";
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
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductOpportunity[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchedFor, setSearchedFor] = useState("");

  function runDiscovery(term: string) {
    setIsSearching(true);
    setResults(null);

    // Small delay so the scan feels deliberate; real marketplace lookups
    // will replace this in a future version.
    setTimeout(() => {
      setResults(discoverOpportunities(term));
      setSearchedFor(term.trim());
      setIsSearching(false);
    }, 600);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    runDiscovery(query);
  }

  function handleExampleClick(example: string) {
    setQuery(example);
    runDiscovery(example);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={'e.g. "I have $500", "high margin", "trending kitchen products"...'}
          className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 outline-none ring-emerald-500/40 focus:border-emerald-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          type="submit"
          disabled={isSearching}
          className="rounded-xl bg-zinc-900 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {isSearching ? "Searching..." : "Find Opportunities"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-zinc-500 dark:text-zinc-500">Try:</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => handleExampleClick(example)}
            className="rounded-full border border-zinc-300 px-3 py-1 text-zinc-700 transition-colors hover:border-emerald-500 hover:text-emerald-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
          >
            {example}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleExampleClick(IDK_EXAMPLE)}
          className="rounded-full border border-dashed border-zinc-300 px-3 py-1 italic text-zinc-700 transition-colors hover:border-emerald-500 hover:text-emerald-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
        >
          {IDK_EXAMPLE}
        </button>
      </div>

      {isSearching && (
        <div className="mt-12 flex flex-col items-center gap-3 text-zinc-500 dark:text-zinc-500">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-500 dark:border-zinc-700" />
          <p className="text-sm">Scanning for opportunities...</p>
        </div>
      )}

      {results && !isSearching && (
        <section className="mt-10">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Top Product Opportunities
            {searchedFor ? ` for "${searchedFor}"` : ""}
          </h2>

          <div className="mt-4 space-y-4">
            {results.map((opp, index) => {
              const styles = RECOMMENDATION_STYLES[opp.recommendation];
              return (
                <div
                  key={opp.productName}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        {index + 1}. {opp.category}
                      </p>
                      <h3 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">
                        {opp.productName}
                      </h3>
                      <span
                        className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${styles.badge}`}
                      >
                        {opp.recommendation}
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col items-center">
                      <span className={`text-2xl font-bold ${styles.text}`}>
                        {opp.opportunityScore}
                      </span>
                      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                        Score
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {opp.shortExplanation}
                  </p>
                  {!opp.shortExplanation.includes("$") && (
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                      Typical price range: ${opp.priceMin} - ${opp.priceMax}
                    </p>
                  )}

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900/50">
                      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                        Demand
                      </div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {opp.demand}/100
                      </div>
                    </div>
                    <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900/50">
                      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                        Competition
                      </div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {opp.competition}/100
                      </div>
                    </div>
                    <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900/50">
                      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                        Margin
                      </div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {opp.marginPotential}/100
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onAnalyze(opp.productName)}
                    className="mt-4 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    Analyze this product →
                  </button>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-500">
            <span className="font-semibold text-zinc-600 dark:text-zinc-400">
              AI Market Estimate —
            </span>{" "}
            Based on curated product profiles and category patterns. Live
            marketplace data integration coming soon.
          </p>
        </section>
      )}
    </div>
  );
}
