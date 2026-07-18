// Node ESM loader hook used only by scripts/test-keepa.js so it can import
// the project's real TypeScript source files directly, without a bundler.
// Two things Node's own resolver doesn't do that the project's bundler-style
// tsconfig ("moduleResolution": "bundler") allows and the source relies on:
//   1. The "@/*" -> "./src/*" path alias.
//   2. Extensionless relative imports (e.g. "./scoringUtils" instead of
//      "./scoringUtils.ts").
// This hook translates both, and nothing else. Test tooling only; never
// imported by production code.
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const PROJECT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CANDIDATE_SUFFIXES = [".ts", ".tsx", "/index.ts"];

export async function resolve(specifier, context, nextResolve) {
  const target = specifier.startsWith("@/")
    ? pathToFileURL(path.join(PROJECT_ROOT, "src", specifier.slice(2))).href
    : specifier;

  try {
    return await nextResolve(target, context);
  } catch (err) {
    if (err?.code !== "ERR_MODULE_NOT_FOUND") throw err;
    for (const suffix of CANDIDATE_SUFFIXES) {
      try {
        return await nextResolve(target + suffix, context);
      } catch {
        // try the next candidate extension
      }
    }
    throw err;
  }
}
