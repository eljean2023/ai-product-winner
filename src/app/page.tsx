"use client";

import { useRef, useState } from "react";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import MarketplaceIntelligence from "@/components/landing/MarketplaceIntelligence";
import ProductAnalyzer, {
  type ProductAnalyzerHandle,
} from "@/components/ProductAnalyzer";
import ProductDiscovery from "@/components/ProductDiscovery";

type Mode = "discover" | "analyze";

export default function Home() {
  const [mode, setMode] = useState<Mode>("discover");
  const analyzerRef = useRef<ProductAnalyzerHandle>(null);

  function handleAnalyzeFromDiscovery(productName: string) {
    analyzerRef.current?.runAnalysis(productName);
    setMode("analyze");
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-12 font-sans sm:px-6 sm:py-16">
      <main className="w-full max-w-4xl">
        <Hero />
        <HowItWorks />
        <MarketplaceIntelligence />

        <div className="mx-auto mt-16 max-w-2xl text-center">
          <p className="text-sm text-slate-500 dark:text-slate-500">
            {mode === "discover"
              ? "Not sure what to sell? Discover product opportunities worth exploring."
              : "Or analyze a specific product idea below."}
          </p>
        </div>

        <div className="mx-auto mt-4 flex max-w-2xl gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setMode("discover")}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              mode === "discover"
                ? "bg-gradient-to-r from-primary to-secondary text-white shadow-sm"
                : "text-slate-600 hover:text-dark dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            Discover Products
          </button>
          <button
            type="button"
            onClick={() => setMode("analyze")}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              mode === "analyze"
                ? "bg-gradient-to-r from-primary to-secondary text-white shadow-sm"
                : "text-slate-600 hover:text-dark dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            Analyze a Product
          </button>
        </div>

        <div className="mt-8">
          <div className={mode === "discover" ? "" : "hidden"}>
            <ProductDiscovery onAnalyze={handleAnalyzeFromDiscovery} />
          </div>
          <div className={mode === "analyze" ? "" : "hidden"}>
            <ProductAnalyzer ref={analyzerRef} />
          </div>
        </div>
      </main>
    </div>
  );
}
