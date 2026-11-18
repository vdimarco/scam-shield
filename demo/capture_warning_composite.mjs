import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const cdpUrl = process.env.CAPTURE_CDP_URL;
if (!cdpUrl) throw new Error("Set CAPTURE_CDP_URL to a model-ready Chrome test profile.");
const server = createServer(async (request, response) => {
  const path = request.url === "/style.css" ? resolve(root, "evaluation/fixtures/style.css")
    : request.url === "/parcel-status.html" ? resolve(root, "evaluation/fixtures/parcel-status.html")
    : resolve(root, "demo/fixtures/parcel-fee-capture.html");
  response.setHeader("content-type", path.endsWith(".css") ? "text/css" : "text/html");
  response.end(await readFile(path));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.connectOverCDP(cdpUrl);
const context = browser.contexts()[0];
const output = resolve(root, "demo/automatic-warning-and-panel-on-device.webm");
const evidence = resolve(root, "demo/automatic-warning-and-panel-on-device.json");
const framesDir = await mkdtemp(join(tmpdir(), "scam-shield-warning-"));
let recording = false;
let frameLoop;
let helper;
let fixture;
try {
  const session = await browser.newBrowserCDPSession();
  const { extensions } = await session.send("Extensions.getExtensions");
  const id = extensions.find((extension) => extension.name === "Scam Shield" && extension.enabled)?.id;
  if (!id) throw new Error("The Scam Shield extension is not loaded in this Chrome profile.");
  const panelUrl = `chrome-extension://${id}/sidepanel.html`;
  helper = await context.newPage();
  await helper.goto(panelUrl);
  await helper.evaluate(() => {
    const button = document.createElement("button");
    button.id = "open-native-panel";
    button.addEventListener("click", async () => chrome.sidePanel.open({ windowId: (await chrome.windows.getCurrent()).id }));
    document.body.append(button);
  });
  const findPanel = async () => {
    for (const page of context.pages().filter((page) => page.url() === panelUrl && page !== helper)) {
      if (await page.evaluate(() => innerWidth).catch(() => 0) === 360) return page;
    }
  };
  let panel = await findPanel();
  for (let attempt = 0; attempt < 2; attempt++) {
    if (panel) break;
    await helper.locator("#open-native-panel").click();
    for (let i = 0; i < 20; i++) {
      panel = await findPanel();
      if (panel) break;
      await new Promise((done) => setTimeout(done, 250));
    }
  }
  if (!panel || await panel.evaluate(() => innerWidth) !== 360)
    throw new Error(`Chrome's native 360px side panel did not open: ${JSON.stringify(context.pages().map((page) => page.url()))}`);
  await helper.close();
  helper = undefined;
  fixture = await context.newPage();
  await fixture.setViewportSize({ width: 920, height: 720 });
  await fixture.goto(`${base}/parcel-status.html`);
  await fixture.bringToFront();
  await panel.evaluate(() => chrome.storage.local.set({ localScreeningEnabled: false }));
  await panel.reload();
  await fixture.bringToFront();
  if (!(await panel.locator("#enable").isVisible())) throw new Error("Private screening setup was absent.");
  await panel.locator("#enable").click();
  await fixture.bringToFront();
  await panel.waitForFunction(() => document.getElementById("mode")?.textContent?.startsWith("Automatic checks run on this computer."), null, { timeout: 120000 });
  await panel.waitForFunction(() => document.getElementById("verdict")?.dataset.risk !== "idle", null, { timeout: 70000 });

  let frame = 0;
  const started = performance.now();
  recording = true;
  frameLoop = (async () => {
    while (recording) {
      const stamp = String(frame).padStart(4, "0");
      try {
        await Promise.all([
          fixture.screenshot({ path: join(framesDir, `page-${stamp}.png`) }),
          panel.screenshot({ path: join(framesDir, `panel-${stamp}.png`), clip: { x: 0, y: 0, width: 360, height: 720 } }),
        ]);
        frame++;
      } catch (error) {
        console.error(`Frame ${frame} capture failed:`, error);
      }
      await new Promise((done) => setTimeout(done, Math.max(0, started + frame * 100 - performance.now())));
    }
  })();
  await fixture.goto(`${base}/parcel-fee.html`);
  await panel.waitForFunction(() => document.getElementById("verdict")?.dataset.risk === "suspicious", null, { timeout: 70000 });
  await fixture.locator("#scam-shield-warning").waitFor({ state: "visible", timeout: 10000 });
  const result = {
    browser: browser.version(),
    fixture: "Synthetic inert local demo/fixtures/parcel-fee-capture.html; no live scam site opened",
    nativePanelWidth: await panel.evaluate(() => innerWidth),
    risk: await panel.locator("#verdict").getAttribute("data-risk"),
    source: await panel.locator("#source").textContent(),
    warningVisible: await fixture.locator("#scam-shield-warning").isVisible(),
    composition: "Two synchronized genuine Chrome targets: synthetic fixture page and native extension side panel, stacked side by side.",
  };
  if (!result.source?.includes("was checked on this computer.") || result.risk !== "suspicious" || !result.warningVisible)
    throw new Error(`The automatic on-device warning was not verified: ${JSON.stringify(result)}`);
  await new Promise((done) => setTimeout(done, Math.max(0, 9000 - (performance.now() - started))));
  recording = false;
  await frameLoop;
  const encoded = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-framerate", "6", "-i", join(framesDir, "page-%04d.png"), "-framerate", "6", "-i", join(framesDir, "panel-%04d.png"), "-filter_complex", "[1:v]scale=360:720[panel];[0:v][panel]hstack=inputs=2[v]", "-map", "[v]", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "5", "-pix_fmt", "yuv420p", output], { encoding: "utf8" });
  if (encoded.status !== 0) throw new Error(encoded.stderr);
  await writeFile(evidence, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ output, evidence, ...result }));
} finally {
  recording = false;
  await frameLoop?.catch(() => {});
  await helper?.close().catch(() => {});
  await fixture?.close().catch(() => {});
  await browser.close();
  await new Promise((done) => server.close(done));
  await rm(framesDir, { recursive: true, force: true });
}
