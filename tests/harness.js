'use strict';
/** Tiny zero-dep test harness — enough for CI without installing Jest/Vitest. */
const assert = require('assert');

const TESTS = [];
function test(name, fn) { TESTS.push({ name, fn }); }

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];
  for (const t of TESTS) {
    const t0 = Date.now();
    try {
      await Promise.resolve(t.fn());
      const dt = Date.now() - t0;
      console.log(`  ✓ ${t.name}  (${dt}ms)`);
      passed++;
    } catch (e) {
      const dt = Date.now() - t0;
      console.log(`  ✗ ${t.name}  (${dt}ms)`);
      failures.push({ name: t.name, error: e });
      failed++;
    }
  }
  console.log('');
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed) {
    console.log('');
    for (const f of failures) {
      console.log(`  ── ${f.name} ─────`);
      console.log(f.error && f.error.stack ? f.error.stack : String(f.error));
      console.log('');
    }
    process.exit(1);
  }
}

module.exports = { test, run, assert };
