import assert from "node:assert/strict";
import test from "node:test";
import { parseDataset } from "./local-runner-logic.ts";
import { runCase } from "./run-bounded-local.mjs";

test("a timed-out case closes its tab and exports only metadata", async () => {
  let closed = false;
  const page = {
    route: async () => {},
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
  assert.doesNotMatch(JSON.stringify(outcome), /private/i);
});
