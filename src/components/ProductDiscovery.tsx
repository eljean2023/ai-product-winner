"use client";

import { useState, type FormEvent } from "react";
import type { ProductOpportunity } from "@/lib/engine";
import { useMarketplaceCountry } from "./MarketplaceCountryContext";
import { RECOMMENDATION_STYLES } from "./recommendationStyles";

const EXAMPLES = ["iphone", "gaming mouse", "usb c charger", "office chair", "wireless earbuds"];

interface ProductDiscoveryProps {
  onAnalyze: (productName: string) => void;
}

interface DiscoverResponse {
  products: ProductOpportunity[];
  reason?: string;
}

export default function ProductDiscovery({ onAnalyze }: ProductDiscoveryProps) {
  const { country } = useMarketplaceCountry();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ProductOpportunity[] | null>(null);
  const [reason, setReason] = useState<string | undefined>(undefined);
  const [isSearching, setIsSearching] = useState(false);
  const [searchedFor, setSearchedFor] = useState("");

  async function runDiscovery(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;

    setIsSearching(true);
    setProducts(null);
    setReason(undefined);

    try {
      const params = new URLSearchParams({ q: trimmed });
      if (country) params.set("country", country);
      const res = await fetch(`/api/discover?${params.toString()}`);
      const data = (await res.json()) as DiscoverResponse;
      setProducts(data.products ?? []);
      setReason(data.reason);
      setSearchedFor(trimmed);
    } catch {
      setProducts([]);
      setReason("Something went wrong while searching marketplaces. Please try again.");
      setSearchedFor(trimmed);
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
          id="discovery-search-input" // must match the id Hero.tsx's CTA scrolls to/focuses
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='e.g. "iphone", "gaming mouse", "usb c charger"...'
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
      </div>

      {isSearching && (
        <div className="mt-12 flex flex-col items-center gap-3 text-slate-500">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-primary" />
          <p className="text-sm">Searching marketplaces for real listings...</p>
        </div>
      )}

      {products && !isSearching && (
        <section className="mt-10">
          <h2 className="text-lg font-bold text-dark dark:text-slate-50">
            Top Product Opportunities
            {searchedFor ? ` for "${searchedFor}"` : ""}
          </h2>

          {products.length === 0 && (
            <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
              {reason ?? "No products found."}
            </p>
          )}

          <div className="mt-4 space-y-4">
            {products.map((product, index) => {
              const styles = RECOMMENDATION_STYLES[product.recommendation];
              return (
                <div
                  key={product.permalink}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      {product.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- external marketplace image, not a local asset
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-800"
                        />
                      )}
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {index + 1}. {product.marketplaceName}
                        </p>
                        <a
                          href={product.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block text-lg font-bold text-dark hover:underline dark:text-slate-50"
                        >
                          {product.title}
                        </a>
                        <span
                          className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${styles.badge}`}
                        >
                          {product.recommendation}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-center">
                      <span className={`text-2xl font-bold ${styles.text}`}>
                        {product.opportunityScore}
                      </span>
                      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        Score
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                    {product.shortExplanation}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Current price: {product.price} {product.currency}
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">
                        Demand
                      </div>
                      <div className="text-sm font-semibold text-dark dark:text-slate-100">
                        {product.dimensions.demand}/100
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">
                        Competition
                      </div>
                      <div className="text-sm font-semibold text-dark dark:text-slate-100">
                        {product.dimensions.competition}/100
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">
                        Margin
                      </div>
                      <div className="text-sm font-semibold text-dark dark:text-slate-100">
                        {product.dimensions.margin}/100
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onAnalyze(product.title)}
                    className="mt-4 text-sm font-semibold text-primary-dark hover:underline dark:text-secondary"
                  >
                    Analyze this product →
                  </button>
                </div>
              );
            })}
          </div>

          {products.length > 0 && (
            <p className="mt-6 text-xs text-slate-500">
              <span className="font-semibold text-slate-600 dark:text-slate-400">
                Real Marketplace Data —
              </span>{" "}
              Ranked using the AI Opportunity Engine on real listings from every connected marketplace for this search.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
