import assert from "node:assert/strict";
import test from "node:test";
import { downloadedTextModel, textModelOptions } from "../src/local-model.ts";

test("restores private screening only for an already available text model", async () => {
  const original = globalThis.LanguageModel;
  try {
    for (const status of ["downloadable", "downloading", "unavailable", "available"]) {
      let suppliedOptions;
      globalThis.LanguageModel = { availability: async (options) => {
        suppliedOptions = options;
        return status;
      } };
      assert.equal(await downloadedTextModel(), status === "available");
      assert.deepEqual(suppliedOptions, textModelOptions);
    }
    delete globalThis.LanguageModel;
    assert.equal(await downloadedTextModel(), false);
  } finally {
    globalThis.LanguageModel = original;
  }
});
