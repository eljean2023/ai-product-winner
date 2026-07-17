"use client";

import { useImperativeHandle, useState, type FormEvent, type Ref } from "react";
import {
  analyzeProduct,
  DIMENSION_LABELS,
  RISK_DIMENSIONS,
  type AnalysisResult,
  type DimensionKey,
} from "@/lib/engine";
import { CONFIDENCE_STYLES, RECOMMENDATION_STYLES } from "./recommendationStyles";

const EXAMPLES = ["wireless earbuds", "ergonomic office chair with footrest", "gaming mouse"];

const DIMENSION_ORDER: DimensionKey[] = [
  "demand",
  "margin",
  "competition",
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
        className="stroke-zinc-200 dark:stroke-zinc-800"
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
        className="rotate-90 fill-zinc-900 text-2xl font-semibold dark:fill-zinc-50"
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
  if (fav >= 40) return "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50";
  return "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-500/10";
}

function DimensionCard({ dimKey, value }: { dimKey: DimensionKey; value: number }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${dimensionTint(dimKey, value)}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
        {DIMENSION_LABELS[dimKey]}
      </div>
      <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {value}/100
      </div>
    </div>
  );
}

interface ProductAnalyzerProps {
  ref?: Ref<ProductAnalyzerHandle>;
}

export default function ProductAnalyzer({ ref }: ProductAnalyzerProps) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");

  function runAnalysis(term: string) {
    const trimmed = term.trim();
    if (!trimmed) {
      setError("Enter a product idea or keyword to find a winner.");
      setResult(null);
      return;
    }

    setError("");
    setIsAnalyzing(true);
    setResult(null);

    // Small delay so the scan feels deliberate; real data lookups will
    // replace this in a future version.
    setTimeout(() => {
      setResult(analyzeProduct(trimmed));
      setIsAnalyzing(false);
    }, 600);
  }

  useImperativeHandle(ref, () => ({
    runAnalysis: (term: string) => {
      setQuery(term);
      runAnalysis(term);
    },
  }));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    runAnalysis(query);
  }

  function handleExampleClick(example: string) {
    setQuery(example);
    runAnalysis(example);
  }

  const styles = result ? RECOMMENDATION_STYLES[result.recommendation] : null;

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter a product idea or keyword, e.g. wireless earbuds"
          className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 outline-none ring-emerald-500/40 focus:border-emerald-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          type="submit"
          disabled={isAnalyzing}
          className="rounded-xl bg-zinc-900 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {isAnalyzing ? "Scanning..." : "Find Winning Product"}
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
      </div>

      {error && (
        <p className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {isAnalyzing && (
        <div className="mt-12 flex flex-col items-center gap-3 text-zinc-500 dark:text-zinc-500">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-500 dark:border-zinc-700" />
          <p className="text-sm">Scanning for market potential...</p>
        </div>
      )}

      {result && styles && !isAnalyzing && (
        <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {result.category}
              </p>
              <h2 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
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
              </div>
              <p className="mt-2 max-w-sm text-xs text-zinc-500 dark:text-zinc-500">
                {result.confidenceReason}
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Typical price range: ${result.priceMin} - ${result.priceMax}
              </p>
            </div>
            <div className="flex flex-col items-center">
              <ScoreRing score={result.opportunityScore} ringClass={styles.ring} />
              <span className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Opportunity Score
              </span>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {DIMENSION_ORDER.map((dimKey) => (
              <DimensionCard key={dimKey} dimKey={dimKey} value={result.dimensions[dimKey]} />
            ))}
          </div>

          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
            <span className="font-semibold text-zinc-600 dark:text-zinc-400">
              AI Market Estimate —
            </span>{" "}
            Every dimension above is calculated independently from category
            patterns and this product&apos;s own name. Live marketplace data
            integration coming soon.
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Why this product could work
              </h3>
              <ul className="mt-3 space-y-2">
                {result.positives.map((signal) => (
                  <li
                    key={signal}
                    className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                    <span>{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                What to watch
              </h3>
              <ul className="mt-3 space-y-2">
                {result.risks.map((signal) => (
                  <li
                    key={signal}
                    className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    <span className="text-amber-600 dark:text-amber-400">⚠</span>
                    <span>{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Next Steps
            </h3>
            <ul className="mt-3 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              <li>• Check competitors</li>
              <li>• Compare suppliers</li>
              <li>• Validate market demand</li>
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
