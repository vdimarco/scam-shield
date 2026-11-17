import assert from "node:assert/strict";
import test from "node:test";
import { parseVerdict } from "../src/verdict.ts";

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
    JSON.stringify({ risk: "safe", reason: 4 }),
  ]) {
    const verdict = parseVerdict(output, undefined);
    assert.equal(verdict.risk, "unsure");
    assert.match(verdict.reason, /verify.*independently/i);
    assert.equal(verdict.ranOnDevice, null);
  }
});
