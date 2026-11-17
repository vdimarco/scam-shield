import assert from "node:assert/strict";
import test from "node:test";
import { errorType, outcomeFromVerdict, parseDataset, summarize } from "./local-runner-logic.ts";

const page = {
  url: "https://example.invalid/test", title: "Test", text: "Check this message", truncated: false,
  asksForPassword: false, asksForCard: false, formsPostElsewhere: 0, mismatchedLinks: 0,
};

test("accepts inert page snapshots and rejects conflicting or oversized input", () => {
  const data = { cases: [{ id: "scam/shopping/sha-1", label: "scam", category: "shopping", page }] };
  assert.equal(parseDataset(data)[0].expectedRisk, "suspicious");
  assert.equal(parseDataset(data)[0].category, "shopping");
  assert.equal(parseDataset({ cases: [{ ...data.cases[0], page: { ...page, text: "" } }] })[0].page.text, "");
  assert.throws(() => parseDataset({ cases: [{ ...data.cases[0], expectedRisk: "safe" }] }), /conflicts/);
  assert.throws(() => parseDataset({ cases: [{ ...data.cases[0], page: { ...page, text: "x".repeat(12001) } }] }), /PageSnapshot/);
  assert.throws(() => parseDataset({ cases: [data.cases[0], data.cases[0]] }), /duplicate/);
  assert.equal(parseDataset({ cases: Array.from({ length: 200 }, (_, index) => ({ ...data.cases[0], id: `case-${index}` })) }).length, 200);
  assert.throws(() => parseDataset({ cases: Array.from({ length: 201 }, (_, index) => ({ ...data.cases[0], id: `case-${index}` })) }), /1–200/);
});

test("unknown sources and errors do not inflate local successes", () => {
  const sample = parseDataset({ cases: [{ id: "scam/shopping/sha-1", label: "scam", page }] })[0];
  const cloud = outcomeFromVerdict(sample, { risk: "suspicious", reason: "Warning", ranOnDevice: false }, 27);
  assert.equal(cloud.observedRisk, "error");
  assert.equal(cloud.error, "nonlocal-source");
  assert.equal(cloud.inferenceSource, "cloud");
  const results = [
    { id: "a", label: "scam", expectedRisk: "suspicious", observedRisk: "suspicious", inferenceSource: "on-device", error: null, elapsedMs: 45 },
    { id: "b", label: "benign", expectedRisk: "safe", observedRisk: "error", inferenceSource: "unknown", error: "nonlocal-source", elapsedMs: 10 },
  ];
  const summary = summarize(results);
  assert.equal(summary.localSuccesses, 1);
  assert.equal(summary.byLabel.benign.error, 1);
  assert.equal(summary.sources.unknown, 1);
});

test("records only a bounded error name and code", () => {
  assert.equal(errorType({ name: "QuotaExceededError", code: "ai/local-model" }), "QuotaExceededError/ai/local-model");
  assert.equal(errorType({ name: "private page text", code: "secret token=123" }), "UnknownError");
  assert.equal(errorType(null), "UnknownError");
});
