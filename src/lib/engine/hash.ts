// Deterministic hashing so the same product name always produces the same
// scores, while different products (or different dimensions of the same
// product) diverge. Never use Math.random() here — determinism is the point.

export function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}

// Deterministic integer in [min, max] derived from a seed string. Callers
// salt the seed per-dimension (e.g. `${name}::demand`) so dimensions vary
// independently instead of all moving together.
export function seededValue(seed: string, min: number, max: number): number {
  if (max <= min) return min;
  const hash = hashString(seed);
  return min + (hash % (max - min + 1));
}
