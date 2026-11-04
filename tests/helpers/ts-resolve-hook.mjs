// Uzantısız göreli içe aktarmaları (.ts, /index.ts) çözen Node yükleyici kancası — testler için.
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
export async function resolve(specifier, context, next) {
  if ((specifier.startsWith(".") || specifier.startsWith("/")) && context.parentURL && ![".ts",".mjs",".js",".json"].includes(path.extname(specifier))) {
    const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    for (const cand of [base + ".ts", path.join(base, "index.ts")]) {
      if (fs.existsSync(cand)) return next(pathToFileURL(cand).href, context);
    }
  }
  return next(specifier, context);
}
