import assert from "node:assert/strict";
import test from "node:test";
import { parseDataset } from "./local-runner-logic.ts";
import { ensureLocalModel, runCase } from "./run-bounded-local.mjs";

test("a timed-out case closes its tab and exports only metadata", async () => {
  let closed = false;
  const page = {
    route: async () => {},
    on: () => {},
    goto: async () => {},
    evaluate: () => new Promise(() => {}),
    close: async () => { closed = true; },
    isClosed: () => closed,
  };
  const [sample] = parseDataset({ cases: [{
    id: "scam/test/1", label: "scam", page: {
      url: "https://private.invalid/", title: "Private", text: "private page content", truncated: false,
      asksForPassword: false, asksForCard: false, formsPostElsewhere: 0, mismatchedLinks: 0,
    },
  }] });
  const outcome = await runCase({ newPage: async () => page }, sample, 10);
  assert.equal(closed, true);
  assert.equal(outcome.error, "deadline-exceeded");
  assert.equal(outcome.inferenceSource, "unknown");
  assert.equal(outcome.lastStage, "loaded");
  assert.doesNotMatch(JSON.stringify(outcome), /private/i);
});

test("timeout markers distinguish session creation from prompt inference", async () => {
  const [sample] = parseDataset({ cases: [{
    id: "benign/test/1", label: "benign", page: {
      url: "https://private.invalid/", title: "Private", text: "private page content", truncated: false,
      asksForPassword: false, asksForCard: false, formsPostElsewhere: 0, mismatchedLinks: 0,
    },
  }] });
  for (const [markers, expected] of [
    [["session-create"], "session-create"],
    [["session-create", "session-ready", "prompt-start"], "prompt-start"],
  ]) {
    let listener;
    let closed = false;
    const page = {
      route: async () => {},
      on: (_, callback) => { listener = callback; },
      goto: async () => {},
      evaluate: () => {
        for (const marker of markers) listener({ text: () => `ScamShieldDiagnostic:${marker}` });
        return new Promise(() => {});
      },
      close: async () => { closed = true; },
      isClosed: () => closed,
    };
    const outcome = await runCase({ newPage: async () => page }, sample, 10);
    assert.equal(outcome.error, "deadline-exceeded");
    assert.equal(outcome.lastStage, expected);
    assert.doesNotMatch(JSON.stringify(outcome), /private/i);
  }
});

test("a stalled local-model availability preflight stops and closes its tab", async () => {
  let closed = false;
  const page = {
    route: async () => {},
    goto: async () => {},
    evaluate: () => new Promise(() => {}),
    close: async () => { closed = true; },
  };
  await assert.rejects(ensureLocalModel({ newPage: async () => page }, 10), /availability check timed out/);
  assert.equal(closed, true);
});
