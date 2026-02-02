/**
 * Test Runner
 * Auto-discovers and runs all *.test.js files in this directory.
 * Run with: node Test/js/tests/run-all.js
 */

import { readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const testsDir = dirname(fileURLToPath(import.meta.url));
const testFiles = readdirSync(testsDir).filter((f) => f.endsWith(".test.js"));

for (const file of testFiles) {
  console.log(`\n--- Running ${file} ---`);
  await import(`./${file}`);
}
