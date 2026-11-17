import assert from "node:assert/strict";
import test from "node:test";
import { collect } from "../src/page.ts";

test("displayed host must match exactly or on a subdomain boundary", () => {
  const originalLocation = globalThis.location;
  const originalDocument = globalThis.document;
  globalThis.location = new URL("https://example.test/");
  globalThis.document = {
    title: "Link check",
    body: { innerText: "Links" },
    forms: [],
    querySelectorAll: (selector) => selector === "a[href]" ? [
      { textContent: "bank.example", href: "https://evilbank.example/" },
      { textContent: "bank.example", href: "https://bank.example.evil/" },
      { textContent: "bank.example", href: "https://login.bank.example/" },
      { textContent: "www.bank.example", href: "https://bank.example/" },
    ] : [],
  };
  try {
    assert.equal(collect(100).mismatchedLinks, 2);
    assert.equal(collect(100).truncated, false);
    assert.equal(collect(3).truncated, true);
    assert.equal(collect(3).text, "Lin");
  } finally {
    globalThis.location = originalLocation;
    globalThis.document = originalDocument;
  }
});
