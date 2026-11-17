import assert from "node:assert/strict";
import test from "node:test";
import { accountForPartialPage, parseVerdict } from "../src/verdict.ts";

test("accepts a complete verdict and preserves its reported inference source", () => {
  assert.deepEqual(parseVerdict(
    JSON.stringify({ risk: "suspicious", tactics: ["urgency or threats"], reason: "  It demands immediate payment.  " }),
    "on_device",
  ), {
    risk: "suspicious",
    tactics: ["urgency or threats"],
    reason: "It demands immediate payment.",
    ranOnDevice: true,
  });
});

test("malformed or incomplete model output never becomes safe", () => {
  for (const output of [
    "not JSON",
    "null",
    JSON.stringify({ risk: "unknown", tactics: [], reason: "fine" }),
    JSON.stringify({ risk: "safe", tactics: [], reason: " " }),
    JSON.stringify({ risk: "safe", reason: "No warning signs" }),
    JSON.stringify({ risk: "safe", tactics: ["invented tactic"], reason: "No warning signs" }),
  ]) {
    const verdict = parseVerdict(output, undefined);
    assert.equal(verdict.risk, "unsure");
    assert.match(verdict.reason, /verify.*independently/i);
    assert.equal(verdict.ranOnDevice, null);
  }
});

test("a safe verdict based on partial page text becomes unsure", () => {
  const safe = parseVerdict(JSON.stringify({ risk: "safe", tactics: [], reason: "No warning signs found." }), "in_cloud");
  const partial = accountForPartialPage(safe, true);
  assert.equal(partial.risk, "unsure");
  assert.match(partial.reason, /only part of this page/i);
  assert.equal(accountForPartialPage(safe, false), safe);
});
