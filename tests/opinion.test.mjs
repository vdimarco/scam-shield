import assert from "node:assert/strict";
import test from "node:test";
import { opinionSourceNote } from "../src/opinion.ts";

test("second opinion explains whether web evidence is available", () => {
  assert.match(opinionSourceNote(true, false), /web verification is unavailable.*only the page shown/i);
  assert.match(opinionSourceNote(false, false), /no web sources to review/i);
  assert.doesNotMatch(opinionSourceNote(false, false), /unavailable/i);
  assert.doesNotMatch(opinionSourceNote(false, false), /only the page shown/i);
  assert.match(opinionSourceNote(false, true), /open these sources/i);
});
