"use client";

import { useImperativeHandle, useMemo, useState, type FormEvent, type Ref } from "react";
import type { AnalysisResult, DimensionKey } from "@/lib/engine";
import { DIMENSION_LABELS, RISK_DIMENSIONS } from "@/lib/engine/types";
import { generateOpportunityInsights } from "@/lib/engine/opportunityInsights";
import { MarketplaceButtons, MarketplaceChip } from "./MarketplaceDisplay";
import { useMarketplaceCountry } from "./MarketplaceCountryContext";
import { CONFIDENCE_STYLES, RECOMMENDATION_STYLES } from "./recommendationStyles";

const EXAMPLES = ["wireless earbuds", "ergonomic office chair with footrest", "gaming mouse"];

const DIMENSION_ORDER: DimensionKey[] = [
  "demand",
  "margin",
  "competition",
  "marketSaturation",
  "bundlePotential",
  "brandOpportunity",
  "repeatPurchase",
  "supplierAvailability",
  "shippingComplexity",
  "trendStability",
  "returnRisk",
];

// Lets another workflow (e.g. Product Discovery) hand off a specific
// product name to analyze via a ref, without syncing state through props.
export interface ProductAnalyzerHandle {
  runAnalysis: (term: string) => void;
}

function ScoreRing({ score, ringClass }: { score: number; ringClass: string }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
      <circle
        cx="64"
        cy="64"
        r={radius}
        strokeWidth="12"
        fill="none"
        className="stroke-slate-200 dark:stroke-slate-800"
      />
      <circle
        cx="64"
        cy="64"
        r={radius}
        strokeWidth="12"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className={`${ringClass} transition-[stroke-dashoffset] duration-700 ease-out`}
      />
      <text
        x="64"
        y="64"
        textAnchor="middle"
        dominantBaseline="middle"
        className="rotate-90 fill-dark text-2xl font-semibold dark:fill-slate-50"
        style={{ transformOrigin: "64px 64px" }}
      >
        {score}
      </text>
    </svg>
  );
}

function favorability(key: DimensionKey, value: number): number {
  return RISK_DIMENSIONS.includes(key) ? 100 - value : value;
}

function dimensionTint(key: DimensionKey, value: number): string {
  const fav = favorability(key, value);
  if (fav >= 70) return "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-500/10";
  if (fav >= 40) return "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50";
  return "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-500/10";
}

function DimensionCard({ dimKey, value }: { dimKey: DimensionKey; value: number }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${dimensionTint(dimKey, value)}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {DIMENSION_LABELS[dimKey]}
      </div>
      <div className="mt-1 text-sm font-semibold text-dark dark:text-slate-100">
        {value}/100
      </div>
    </div>
  );
}

interface ProductAnalyzerProps {
  ref?: Ref<ProductAnalyzerHandle>;
}

export default function ProductAnalyzer({ ref }: ProductAnalyzerProps) {
  const { country } = useMarketplaceCountry();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");

  async function runAnalysis(term: string) {
    const trimmed = term.trim();
    if (!trimmed) {
      setError("Enter a product idea or keyword to find a winner.");
      setResult(null);
      return;
    }

    setError("");
    setIsAnalyzing(true);
    setResult(null);

    try {
      const params = new URLSearchParams({ q: trimmed });
      if (country) params.set("country", country);
      const res = await fetch(`/api/analyze?${params.toString()}`);
      const analysis = (await res.json()) as AnalysisResult;
      setResult(analysis);
    } catch {
      setError("Something went wrong while analyzing this product. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  useImperativeHandle(ref, () => ({
    runAnalysis: (term: string) => {
      setQuery(term);
      void runAnalysis(term);
    },
  }));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void runAnalysis(query);
  }

  function handleExampleClick(example: string) {
    setQuery(example);
    void runAnalysis(example);
  }

  const styles = result ? RECOMMENDATION_STYLES[result.recommendation] : null;
  const heroImage = result?.marketplaceData.find((s) => s.available)?.topListing?.imageUrl;
  const insights = useMemo(() => (result ? generateOpportunityInsights(result) : null), [result]);

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter a product idea or keyword, e.g. wireless earbuds"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-dark placeholder:text-slate-400 outline-none ring-orange-500/40 focus:border-orange-500 focus:ring-4 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
        />
        <button
          type="submit"
          disabled={isAnalyzing}
          className="rounded-xl bg-gradient-to-r from-primary to-secondary px-6 py-3 text-base font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isAnalyzing ? "Scanning..." : "Find Winning Product"}
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

      {error && (
        <p className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {isAnalyzing && (
        <div className="mt-12 flex flex-col items-center gap-3 text-slate-500">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-primary" />
          <p className="text-sm">Scanning marketplaces for real-time data...</p>
        </div>
      )}

      {result && styles && !isAnalyzing && (
        <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-4">
              {heroImage && (
                // eslint-disable-next-line @next/next/no-img-element -- external marketplace image, not a local asset
                <img
                  src={heroImage}
                  alt={result.productName}
                  className="h-20 w-20 shrink-0 rounded-xl border border-slate-200 object-cover dark:border-slate-800"
                />
              )}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {result.category}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-dark dark:text-slate-50">
                  {result.productName}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${styles.badge}`}
                  >
                    {result.recommendation}
                  </span>
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${CONFIDENCE_STYLES[result.confidence]}`}
                    title={result.confidenceReason}
                  >
                    {result.confidence} Confidence
                  </span>
                  <span className="inline-block rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 px-3 py-1 text-xs font-semibold text-primary-dark dark:text-secondary">
                    {result.dataConfidence === "hybrid" ? "AI + Live Data" : "AI Estimate"}
                  </span>
                </div>
                <p className="mt-2 max-w-sm text-xs text-slate-500">
                  {result.confidenceReason}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                  {result.dataConfidence === "hybrid" ? "Current price range" : "Typical price range"}: {result.priceMin} - {result.priceMax} {result.priceCurrency}
                </p>
                <p className="mt-2 max-w-sm text-sm text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-dark dark:text-slate-100">Suggested selling angle:</span>{" "}
                  {result.sellingAngle}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <ScoreRing score={result.opportunityScore} ringClass={styles.ring} />
              <span className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                Opportunity Score
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {result.marketplaceData.map((summary) => (
              <MarketplaceChip key={summary.marketplace} summary={summary} />
            ))}
          </div>

          <div className="mt-4">
            <MarketplaceButtons summaries={result.marketplaceData} />
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {DIMENSION_ORDER.map((dimKey) => (
              <DimensionCard key={dimKey} dimKey={dimKey} value={result.dimensions[dimKey]} />
            ))}
          </div>

          <p className="mt-4 text-xs text-slate-500">
            <span className="font-semibold text-slate-600 dark:text-slate-400">
              AI Market Estimate —
            </span>{" "}
            {result.dataConfidence === "hybrid"
              ? "Scores combine real marketplace signals (listings, sellers, ratings, reviews) with category intelligence. Additional providers like Keepa will improve historical analysis."
              : "No live marketplace match was found, so scores combine category intelligence and this product's own name only. Live marketplace signals and additional providers like Keepa will improve this further."}
          </p>

          {insights && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  AI Recommendation
                </span>
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${RECOMMENDATION_STYLES[insights.recommendation].badge}`}
                >
                  {insights.recommendation}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{insights.summary}</p>
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                <span className="font-semibold text-dark dark:text-slate-100">Selling Strategy:</span>{" "}
                {insights.suggestedStrategy}
              </p>
            </div>
          )}

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-dark dark:text-slate-100">
                Why this product could work
              </h3>
              <ul className="mt-3 space-y-2">
                {result.positives.map((signal) => (
                  <li
                    key={signal}
                    className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
                  >
                    <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                    <span>{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-dark dark:text-slate-100">
                What to watch
              </h3>
              <ul className="mt-3 space-y-2">
                {result.risks.map((signal) => (
                  <li
                    key={signal}
                    className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
                  >
                    <span className="text-amber-600 dark:text-amber-400">⚠</span>
                    <span>{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-dark dark:text-slate-100">
              Next Steps
            </h3>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
              <li>• Check competitors on Mercado Libre and Amazon</li>
              <li>• Compare suppliers</li>
              <li>• Validate market demand</li>
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
