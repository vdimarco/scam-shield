import assert from "node:assert/strict";
import test from "node:test";
import { collect, describe, snapshotActiveTab } from "../src/page.ts";

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

test("page capture stays within its privacy cap for invalid remote limits", () => {
  const originalLocation = globalThis.location;
  const originalDocument = globalThis.document;
  globalThis.location = new URL("https://example.test/");
  globalThis.document = {
    title: "Large page",
    body: { innerText: "x".repeat(13_000) },
    forms: [],
    querySelectorAll: () => [],
  };
  try {
    for (const limit of [-1, 0, Infinity, NaN, 100_000]) {
      const page = collect(limit);
      assert.equal(page.text.length, 12_000);
      assert.equal(page.truncated, true);
    }
  } finally {
    globalThis.location = originalLocation;
    globalThis.document = originalDocument;
  }
});

test("active page snapshot retains the exact Chrome tab ID", async () => {
  const originalChrome = globalThis.chrome;
  globalThis.chrome = {
    tabs: { query: async () => [{ id: 7, url: "https://parcel.example.test/pay" }] },
    scripting: { executeScript: async () => [{ result: {
      url: "https://parcel.example.test/pay", title: "Parcel", text: "Pay now", truncated: false,
      asksForPassword: false, asksForCard: true, formsPostElsewhere: 0, mismatchedLinks: 0,
    } }] },
  };
  try {
    assert.equal((await snapshotActiveTab(100))?.tabId, 7);
  } finally {
    globalThis.chrome = originalChrome;
  }
});

test("model prompt keeps host and path but omits URL secrets and bounds metadata", () => {
  const page = {
    url: `https://bank.example/${"a".repeat(3000)}?session=secret-token#private-fragment`,
    title: "T".repeat(700), text: "Page text", truncated: false, tabId: 7,
    asksForPassword: false, asksForCard: false, formsPostElsewhere: 0, mismatchedLinks: 0,
  };
  const prompt = describe(page);
  const address = prompt.match(/^Address: (.*)$/m)?.[1];
  const title = prompt.match(/^Title: (.*)$/m)?.[1];
  assert.equal(address?.length, 2048);
  assert.ok(address?.startsWith("https://bank.example/"));
  assert.equal(title?.length, 500);
  assert.doesNotMatch(prompt, /secret-token|private-fragment|session=/);
  assert.doesNotMatch(prompt, /tabId/);
  assert.match(prompt, /Page text:\nPage text/);
});
