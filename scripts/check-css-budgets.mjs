#!/usr/bin/env node
// Run after pnpm build. Count every initial CSS chunk, including component and
// layout styles, rather than reporting only the smaller generated source file.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const budgets = {
  page: 75_000,
  "rules/page": 110_000,
  "books/page": 75_000,
  "books/[slug]/page": 75_000,
  "contact/page": 110_000,
  "press/page": 110_000,
  "atelier/page": 250_000,
  "characters/[id]/page": 240_000,
  "library/browse/page": 245_000,
  "monsters/page": 245_000,
  "encounters/page": 245_000,
};
let failed = false;
for (const [route, budget] of Object.entries(budgets)) {
  const filename = path.join(root, ".next/server/app", `${route}_client-reference-manifest.js`);
  if (!fs.existsSync(filename)) throw new Error("Build first: pnpm build");
  const context = {};
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), context, { timeout: 1000 });
  const manifest = Object.values(context.__RSC_MANIFEST)[0];
  const files = new Set(Object.values(manifest.entryCSSFiles).flat().map(value =>
    typeof value === "string" ? value : value.path,
  ));
  const gzip = [...files].reduce((total, file) =>
    total + gzipSync(fs.readFileSync(path.join(root, ".next", file))).length, 0,
  );
  const pass = gzip <= budget;
  if (!pass) failed = true;
  console.log(`${pass ? "PASS" : "FAIL"} ${route}: ${gzip.toLocaleString()} / ${budget.toLocaleString()} gzip bytes (${files.size} sheets)`);
}
if (failed) process.exitCode = 1;
