import assert from "node:assert/strict";
import test from "node:test";
import { retryAutomaticLocal } from "./retry-local.ts";

test("retries one generic automatic local failure", async () => {
  let attempts = 0;
  const result = await retryAutomaticLocal(true, async () => {
    if (++attempts === 1) throw new Error("transient model failure");
    return "on-device";
  });
  assert.equal(result, "on-device");
  assert.equal(attempts, 2);
});

test("does not retry manual, aborted, or coded failures", async () => {
  for (const [automatic, error] of [
    [false, new Error("manual failure")],
    [true, new DOMException("aborted", "AbortError")],
    [true, Object.assign(new Error("SDK failure"), { code: "ai/unsupported" })],
  ]) {
    let attempts = 0;
    await assert.rejects(() => retryAutomaticLocal(automatic, async () => {
      attempts++;
      throw error;
    }), (caught) => caught === error);
    assert.equal(attempts, 1);
  }
});

test("propagates the second automatic failure", async () => {
  let attempts = 0;
  const second = new Error("second failure");
  await assert.rejects(() => retryAutomaticLocal(true, async () => {
    if (++attempts === 1) throw new Error("first failure");
    throw second;
  }), (caught) => caught === second);
  assert.equal(attempts, 2);
});
