import assert from "node:assert/strict";
import test from "node:test";
import { accountForPageEvidence } from "./verdict.ts";

const page = {
  url: "https://example.org/", title: "Example", text: "Hello", truncated: false,
  asksForPassword: false, asksForCard: false, formsPostElsewhere: 0, mismatchedLinks: 0,
};
const safe = { risk: "safe", reason: "No warning signs found.", ranOnDevice: true };

test("keeps ordinary safe pages and existing warnings", () => {
  assert.deepEqual(accountForPageEvidence(safe, page), safe);
  const suspicious = { ...safe, risk: "suspicious" };
  assert.deepEqual(accountForPageEvidence(suspicious, { ...page, asksForPassword: true }), suspicious);
});

test("a sensitive field or redirected destination cannot receive a safe verdict", () => {
  for (const evidence of [
    { asksForPassword: true }, { asksForCard: true },
    { formsPostElsewhere: 1 }, { mismatchedLinks: 1 },
  ]) {
    const verdict = accountForPageEvidence(safe, { ...page, ...evidence });
    assert.equal(verdict.risk, "unsure");
    assert.equal(verdict.ranOnDevice, true);
    assert.ok(verdict.reason);
  }
});

test("partial page warning takes precedence", () => {
  const verdict = accountForPageEvidence(safe, { ...page, truncated: true, asksForPassword: true });
  assert.equal(verdict.risk, "unsure");
  assert.match(verdict.reason, /Only part/);
});
