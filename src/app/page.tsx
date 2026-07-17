"use client";

import { useRef, useState } from "react";
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
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-16 font-sans dark:bg-black sm:px-6">
      <main className="w-full max-w-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            AI Product Hunter
          </h1>
          <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
            {mode === "discover"
              ? "Not sure what to sell? Discover product opportunities worth exploring."
              : "Find profitable products before investing money."}
          </p>
        </div>

        <div className="mt-8 flex gap-1 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setMode("discover")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              mode === "discover"
                ? "bg-zinc-900 text-white dark:bg-emerald-600"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            Discover Products
          </button>
          <button
            type="button"
            onClick={() => setMode("analyze")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              mode === "analyze"
                ? "bg-zinc-900 text-white dark:bg-emerald-600"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
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
