// The whole test suite, in one command (`npm test`).
//
// Runs, in this order and each in its own child process:
//   1. scripts/smoke-check.js            files, syntax, versions, CSP, deploy list
//   2. scripts/chess-regression-check.js the original chess/app regression check
//   3. every scripts/tests/*.test.js     alphabetical; files starting with "_" are helpers
//
// It stops at the first failure (fail-fast) and exits non-zero, so the output
// ends with the test that broke. Browser-level checks (scripts/e2e/*.js) need
// Playwright and are not part of this run.

"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const TEST_TIMEOUT_MS = 5 * 60 * 1000;

function testFiles() {
  const dir = path.join(__dirname, "tests");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith(".test.js") && !name.startsWith("_"))
    .sort()
    .map((name) => path.join("scripts", "tests", name));
}

const steps = [
  path.join("scripts", "smoke-check.js"),
  path.join("scripts", "chess-regression-check.js"),
  ...testFiles(),
];

const startedAt = Date.now();
let index = 0;
for (const step of steps) {
  index += 1;
  console.log(`\n[${index}/${steps.length}] node ${step}`);
  const stepStart = Date.now();
  const result = spawnSync(process.execPath, [step], {
    cwd: root,
    stdio: "inherit",
    timeout: TEST_TIMEOUT_MS,
  });
  const seconds = ((Date.now() - stepStart) / 1000).toFixed(1);

  if (result.error) {
    console.error(`\nFAILED [${index}/${steps.length}] ${step}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    const reason = result.signal ? `killed by ${result.signal}` : `exit code ${result.status}`;
    console.error(`\nFAILED [${index}/${steps.length}] ${step} (${reason}, ${seconds}s)`);
    console.error(`Stopped after the first failure. Re-run just this one with: node ${step}`);
    process.exit(result.status || 1);
  }
  console.log(`ok [${index}/${steps.length}] ${step} (${seconds}s)`);
}

const total = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`\nAll ${steps.length} test steps passed in ${total}s.`);
