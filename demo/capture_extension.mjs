import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const profile = process.env.CAPTURE_PROFILE;
if (!profile) throw new Error("Set CAPTURE_PROFILE to a private Chromium test profile with registered Firebase App Check.");
const videoDir = "/tmp/scam-shield-video-recordings";
await mkdir(videoDir, { recursive: true });
const server = createServer(async (req, res) => {
  const path = req.url === "/style.css" ? "style.css" : "parcel-fee.html";
  res.setHeader("content-type", path.endsWith(".css") ? "text/css" : "text/html");
  res.end(await readFile(resolve(root, "evaluation/fixtures", path)));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const port = server.address().port;

const context = await chromium.launchPersistentContext(profile, {
  executablePath: process.env.CAPTURE_BROWSER ?? "/usr/bin/chromium",
  headless: false,
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: videoDir, size: { width: 480, height: 720 } },
  args: [
    `--disable-extensions-except=${root}/dist`,
    `--load-extension=${root}/dist`,
    "--no-first-run",
    "--ozone-platform=x11",
    "--disable-features=Translate",
    "--enable-features=PromptAPIForGeminiNano,PromptAPIForGeminiNanoMultimodalInput",
  ],
});
try {
  const fixture = context.pages()[0] ?? await context.newPage();
  await fixture.goto(`http://127.0.0.1:${port}/parcel-fee.html`);
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 15000 });
  const id = new URL(worker.url()).hostname;
  const panel = await context.newPage();
  await panel.setViewportSize({ width: 480, height: 720 });
  await panel.goto(`chrome-extension://${id}/sidepanel.html`);
  // Reset the count only in this throwaway test profile, so the capture shows these two calls.
  await panel.evaluate(() => chrome.storage.local.set({ ledger: { local: 0, cloud: 0 } }));
  await panel.reload();
  await fixture.bringToFront();
  const [active] = await panel.evaluate(() => chrome.tabs.query({ active: true, currentWindow: true }));
  if (!active?.url?.startsWith(`http://127.0.0.1:${port}/`)) throw new Error("The synthetic fixture is not the active tab.");
  const recording = panel.video();
  const start = performance.now();
  const at = () => +((performance.now() - start) / 1000).toFixed(2);
  const timings = { started: at() };
  await new Promise((done) => setTimeout(done, 1500));
  timings.checkClicked = at();
  await panel.evaluate(() => document.getElementById("check").click());
  await panel.waitForFunction(() => !["Checking…", "Starting…"].includes(document.getElementById("headline").textContent), null, { timeout: 70000 });
  timings.checkResult = at();
  if (!(await panel.locator("#source").textContent())) throw new Error("The first check returned no inference source.");
  if (!(await panel.locator("#second").isVisible())) throw new Error("No second opinion button after check");
  await new Promise((done) => setTimeout(done, 2500));
  timings.secondClicked = at();
  await panel.evaluate(() => document.getElementById("second").click());
  await panel.waitForFunction(() => {
    const value = document.getElementById("opinion-text").textContent;
    return value && value !== "Looking into it…";
  }, null, { timeout: 70000 });
  timings.secondResult = at();
  await new Promise((done) => setTimeout(done, 1200));
  await panel.evaluate(() => document.getElementById("opinion-source-note").scrollIntoView({ block: "center", behavior: "smooth" }));
  timings.noteScrolled = at();
  await new Promise((done) => setTimeout(done, 3000));
  timings.ended = at();
  const observation = {
    browser: context.browser().version(),
    fixture: "Synthetic local parcel-fee.html; no real scam website opened",
    capture: "Playwright recording of installed Chrome extension sidepanel.html in an extension tab while the fixture tab remained active; button actions triggered against the real extension DOM",
    timings,
    check: {
      headline: await panel.locator("#headline").textContent(),
      source: await panel.locator("#source").textContent(),
      risk: await panel.locator("#verdict").getAttribute("data-risk"),
    },
    secondOpinion: {
      note: await panel.locator("#opinion-source-note").textContent(),
      text: await panel.locator("#opinion-text").textContent(),
      links: await panel.locator("#opinion-source-list a").count(),
    },
  };
  const rawVideo = await recording.path();
  await context.close();
  await copyFile(rawVideo, resolve(root, "demo/extension-check-live.webm"));
  await writeFile(resolve(root, "demo/extension-check-live.json"), JSON.stringify(observation, null, 2) + "\n");
  console.log("Recorded demo/extension-check-live.webm and demo/extension-check-live.json");
} finally {
  if (context.browser()?.isConnected()) await context.close();
  await new Promise((done) => server.close(done));
}
