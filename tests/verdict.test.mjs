import assert from "node:assert/strict";
import test from "node:test";
import { accountForPageEvidence, parseVerdict } from "../src/verdict.ts";

test("accepts a complete verdict and preserves its reported inference source", () => {
  assert.deepEqual(parseVerdict(
    JSON.stringify({ risk: "suspicious", reason: "  It demands immediate payment.  " }),
    "on_device",
  ), {
    risk: "suspicious",
    reason: "It demands immediate payment.",
    ranOnDevice: true,
  });
});

test("malformed or incomplete model output never becomes safe", () => {
  for (const output of [
    "not JSON",
    "null",
    JSON.stringify({ risk: "unknown", reason: "fine" }),
    JSON.stringify({ risk: "safe", reason: " " }),
    JSON.stringify({ risk: "safe" }),
  ]) {
    const verdict = parseVerdict(output, undefined);
    assert.equal(verdict.risk, "unsure");
    assert.match(verdict.reason, /verify.*independently/i);
    assert.equal(verdict.ranOnDevice, null);
  }
});

test("a safe verdict based on partial page text becomes unsure", () => {
  const safe = parseVerdict(JSON.stringify({ risk: "safe", reason: "No warning signs found." }), "in_cloud");
  const partial = accountForPageEvidence(safe, { truncated: true });
  assert.equal(partial.risk, "unsure");
  assert.match(partial.reason, /only part of this page/i);
  assert.equal(accountForPageEvidence(safe, { truncated: false }), safe);
});
