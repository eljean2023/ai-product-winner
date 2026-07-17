"use client";

import { useState, type FormEvent } from "react";
import { analyzeProduct, type AnalysisResult } from "@/lib/analyze";

const EXAMPLES = ["wireless earbuds", "usb-c charger", "gaming mouse"];

const RECOMMENDATION_STYLES: Record<
  AnalysisResult["recommendation"],
  { badge: string; ring: string; text: string }
> = {
  "Strong Opportunity": {
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400",
    ring: "stroke-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  "Possible Opportunity": {
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
    ring: "stroke-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  "High Risk": {
    badge: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400",
    ring: "stroke-red-500",
    text: "text-red-600 dark:text-red-400",
  },
};

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

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">{hint}</div>
      )}
    </div>
  );
}

export default function Home() {
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
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-16 font-sans dark:bg-black sm:px-6">
      <main className="w-full max-w-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            AI Product Hunter
          </h1>
          <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
            Find profitable products before investing money.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-10 flex flex-col gap-3 sm:flex-row"
        >
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
                <span
                  className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold ${styles.badge}`}
                >
                  {result.recommendation}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <ScoreRing score={result.opportunityScore} ringClass={styles.ring} />
                <span className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Opportunity Score
                </span>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Demand Potential" value={`${result.demand}/100`} />
              <StatCard label="Competition Risk" value={`${result.competition}/100`} />
              <StatCard label="Margin Potential" value={`${result.marginPotential}/100`} />
              <StatCard
                label="Price Opportunity"
                value={`${result.priceOpportunity}/100`}
                hint={`$${result.priceMin} - $${result.priceMax}`}
              />
            </div>

            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
              <span className="font-semibold text-zinc-600 dark:text-zinc-400">
                AI Market Estimate —
              </span>{" "}
              Based on category patterns and product characteristics. Live
              marketplace data integration coming soon.
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
      </main>
    </div>
  );
}
