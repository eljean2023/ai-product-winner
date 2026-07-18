"use client";

// Must match the id on the search input in ProductDiscovery.tsx.
const SEARCH_INPUT_ID = "discovery-search-input";

function scrollToSearch() {
  const input = document.getElementById(SEARCH_INPUT_ID);
  if (!input) return;
  input.scrollIntoView({ behavior: "smooth", block: "center" });
  (input as HTMLInputElement).focus();
}

export default function Hero() {
  return (
    <section className="text-center">
      <span className="inline-block rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary-dark dark:text-secondary">
        E-Commerce Intelligence
      </span>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-dark dark:text-slate-50 sm:text-4xl">
        Find Winning Products Before You Invest
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-base text-slate-600 dark:text-slate-400">
        Discover product opportunities across multiple marketplaces using AI-powered market analysis.
      </p>
      <button
        type="button"
        onClick={scrollToSearch}
        className="mt-6 rounded-xl bg-gradient-to-r from-primary to-secondary px-6 py-3 text-base font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
      >
        Find Product Opportunities
      </button>
    </section>
  );
}
