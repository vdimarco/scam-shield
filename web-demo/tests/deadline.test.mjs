import assert from "node:assert/strict";
import test from "node:test";
import { DeadlineExceededError, withDeadline } from "../src/deadline.ts";

test("a stalled live check releases the UI wait and a retry can complete", async () => {
  await assert.rejects(withDeadline(new Promise(() => {}), 5), DeadlineExceededError);
  assert.equal(await withDeadline(Promise.resolve("retry complete"), 100), "retry complete");
});
