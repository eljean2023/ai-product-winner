import type { ConfidenceLevel } from "./types";

export interface ConfidenceResult {
  level: ConfidenceLevel;
  reason: string;
}

// Confidence reflects how much the model had to work with, not how good
// the product is. A bare "chair" gives it almost nothing to differentiate
// on; a descriptive multi-word query narrows things down considerably.
export function computeConfidence(query: string, matchedCategory: boolean): ConfidenceResult {
  const words = query.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const hasDescriptors = words.some((w) => w.length > 3);

  let level: ConfidenceLevel;
  if (wordCount >= 4 || (wordCount === 3 && hasDescriptors)) level = "High";
  else if (wordCount >= 2) level = "Medium";
  else level = "Low";

  if (!matchedCategory && level === "High") level = "Medium";
  else if (!matchedCategory && level === "Medium") level = "Low";

  let reason: string;
  if (!matchedCategory) {
    reason = "No specific category matched this keyword, so estimates fall back to broader market patterns.";
  } else if (wordCount <= 1) {
    reason = "A single generic word gives the model little to differentiate this product from others in its category.";
  } else if (wordCount === 2) {
    reason = "A short phrase narrows the category but leaves specifics like features or positioning unclear.";
  } else {
    reason = "A detailed, descriptive query lets the model differentiate this product from generic listings in its category.";
  }

  return { level, reason };
}
