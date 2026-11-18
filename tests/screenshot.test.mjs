import assert from "node:assert/strict";
import test from "node:test";
import { validScreenshot } from "../src/screenshot.ts";

test("screenshot picker accepts only bounded PNG or JPEG files", () => {
  assert.equal(validScreenshot({ type: "image/png", size: 8_000_000 }), true);
  assert.equal(validScreenshot({ type: "image/jpeg", size: 1 }), true);
  for (const file of [
    { type: "image/png", size: 0 },
    { type: "image/png", size: 8_000_001 },
    { type: "image/svg+xml", size: 1_000 },
    { type: "", size: 1_000 },
  ]) assert.equal(validScreenshot(file), false);
});
