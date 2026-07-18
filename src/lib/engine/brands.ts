// Recognized, established brands. Detecting one in a product's own title is
// the strongest available signal that a new seller/brand has little room to
// differentiate on that exact listing — used to sharpen Brand Opportunity
// and Competition Risk wherever a title is available.
export const KNOWN_BRANDS = [
  "apple", "airpods", "samsung", "sony", "xiaomi", "lg", "hp", "dell", "lenovo",
  "nike", "adidas", "logitech", "microsoft", "huawei", "motorola", "asus",
  "acer", "jbl", "bose", "canon", "nikon", "philips", "whirlpool", "dewalt",
  "bosch", "beats", "anker",
];

export function detectBrand(text: string): boolean {
  return findBrand(text) !== null;
}

// Returns the matched brand, title-cased for display (e.g. "Dominated by
// Apple"), or null when the text doesn't mention a known brand.
export function findBrand(text: string): string | null {
  const lower = text.toLowerCase();
  const hit = KNOWN_BRANDS.find((brand) => lower.includes(brand));
  if (!hit) return null;
  if (hit === "airpods") return "Apple";
  return hit.charAt(0).toUpperCase() + hit.slice(1);
}
