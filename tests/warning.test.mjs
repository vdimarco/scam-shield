import assert from "node:assert/strict";
import test from "node:test";
import { setTabWarning } from "../src/page.ts";

test("warns only the active tab whose URL matches the checked page", async () => {
  const originalChrome = globalThis.chrome;
  const calls = [];
  globalThis.chrome = {
    tabs: { query: async () => [{ id: 7, url: "https://parcel.example.test/pay" }] },
    action: {
      setBadgeText: async (args) => calls.push(["badge", args]),
      setBadgeBackgroundColor: async (args) => calls.push(["color", args]),
    },
    scripting: { executeScript: async (args) => calls.push(["inject", args]) },
  };
  try {
    await setTabWarning(7, "https://other.example.test/", "Possible fraud");
    assert.equal(calls.length, 0);

    await setTabWarning(8, "https://parcel.example.test/pay", "Possible fraud");
    assert.equal(calls.length, 0);

    await setTabWarning(7, "https://parcel.example.test/pay", "Asks for a payment to release a parcel.");
    assert.deepEqual(calls.map(([name]) => name), ["badge", "color", "inject"]);
    assert.deepEqual(calls[0][1], { tabId: 7, text: "!" });
    assert.deepEqual(calls[2][1].args, ["https://parcel.example.test/pay", "Asks for a payment to release a parcel."]);

    calls.length = 0;
    await setTabWarning(7, "https://parcel.example.test/pay", null);
    assert.deepEqual(calls.map(([name]) => name), ["badge", "inject"]);
    assert.deepEqual(calls[0][1], { tabId: 7, text: "" });
  } finally {
    globalThis.chrome = originalChrome;
  }
});

test("clears an old warning when the tab navigates", async () => {
  const originalChrome = globalThis.chrome;
  const calls = [];
  let onUpdated;
  globalThis.chrome = {
    sidePanel: { setPanelBehavior: async () => {} },
    tabs: { onUpdated: { addListener: (listener) => { onUpdated = listener; } } },
    action: { setBadgeText: async (args) => calls.push(["badge", args]) },
    scripting: { executeScript: async (args) => calls.push(["inject", args]) },
  };
  try {
    await import("../src/background.ts");
    onUpdated(7, { url: "https://new.example.test/" });
    assert.deepEqual(calls.map(([name]) => name), ["badge", "inject"]);
    assert.deepEqual(calls[0][1], { tabId: 7, text: "" });
    assert.deepEqual(calls[1][1].target, { tabId: 7 });

    calls.length = 0;
    onUpdated(7, { status: "loading" });
    assert.deepEqual(calls.map(([name]) => name), ["badge"]);
  } finally {
    globalThis.chrome = originalChrome;
  }
});
