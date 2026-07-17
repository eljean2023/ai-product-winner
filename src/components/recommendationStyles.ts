import type { ConfidenceLevel, Recommendation } from "@/lib/engine";

export const RECOMMENDATION_STYLES: Record<
  Recommendation,
  { badge: string; ring: string; text: string }
> = {
  "Strong Opportunity": {
    badge:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400",
    ring: "stroke-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  "Possible Opportunity": {
    badge:
      "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
    ring: "stroke-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  "High Risk": {
    badge: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400",
    ring: "stroke-red-500",
    text: "text-red-600 dark:text-red-400",
  },
};

export const CONFIDENCE_STYLES: Record<ConfidenceLevel, string> = {
  High: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400",
  Medium: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
  Low: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};
