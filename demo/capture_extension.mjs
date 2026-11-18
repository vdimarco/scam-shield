import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const profile = process.env.CAPTURE_PROFILE;
const cdpUrl = process.env.CAPTURE_CDP_URL;
if (!profile && !cdpUrl) throw new Error("Set CAPTURE_PROFILE or CAPTURE_CDP_URL for an authorized Chrome test profile.");
const installedExtensionId = process.env.CAPTURE_EXTENSION_ID;
const ozonePlatform = process.env.CAPTURE_OZONE_PLATFORM ?? (process.env.WAYLAND_DISPLAY ? "wayland" : "x11");
const videoDir = "/tmp/scam-shield-video-recordings";
await mkdir(videoDir, { recursive: true });
const server = createServer(async (req, res) => {
  const path = req.url === "/style.css" ? "style.css" : "parcel-fee.html";
  res.setHeader("content-type", path.endsWith(".css") ? "text/css" : "text/html");
  res.end(await readFile(resolve(root, "evaluation/fixtures", path)));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const port = server.address().port;

async function screenshotRecorder(page) {
  const framesDir = await mkdtemp(join(tmpdir(), "scam-shield-panel-"));
  const frames = [];
  const start = performance.now();
  let stopped = false;
  let failure;
  const loop = (async () => {
    while (!stopped) {
      const time = (performance.now() - start) / 1000;
      const path = join(framesDir, `frame-${String(frames.length).padStart(5, "0")}.jpg`);
      // The native side panel is 360 CSS pixels wide; capture its top 540px
      // so the 2:3 video crop retains the exact browser-rendered proportions.
      await page.screenshot({ path, type: "jpeg", quality: 85,
        clip: { x: 0, y: 0, width: 360, height: 540 } });
      frames.push({ path, time });
      await new Promise((done) => setTimeout(done, Math.max(0, start + frames.length * 100 - performance.now())));
    }
  })().catch((error) => { failure = error; });
  return {
    at: () => +((performance.now() - start) / 1000).toFixed(2),
    async stop() {
      if (stopped) return null;
      const end = (performance.now() - start) / 1000;
      stopped = true;
      await loop;
      if (failure || frames.length < 2) {
        await rm(framesDir, { recursive: true, force: true });
        if (failure) throw failure;
        throw new Error("The CDP recording returned too few frames.");
      }
      const playlist = join(framesDir, "frames.txt");
      const lines = [];
      for (let i = 0; i < frames.length; i++) {
        lines.push(`file '${frames[i].path}'`);
        lines.push(`duration ${Math.max(0.01, (frames[i + 1]?.time ?? end) - frames[i].time).toFixed(4)}`);
      }
      lines.push(`file '${frames.at(-1).path}'`);
      await writeFile(playlist, lines.join("\n") + "\n");
      const output = join(videoDir, `panel-${Date.now()}.webm`);
      const result = spawnSync("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0",
        "-i", playlist, "-r", "24", "-c:v", "libvpx-vp9", "-deadline", "realtime",
        "-cpu-used", "5", "-pix_fmt", "yuv420p", output,
      ], { encoding: "utf8" });
      await rm(framesDir, { recursive: true, force: true });
      if (result.status !== 0) throw new Error(`Could not encode CDP recording: ${result.stderr}`);
      return output;
    },
  };
}

const browser = cdpUrl ? await chromium.connectOverCDP(cdpUrl) : null;
const context = browser ? browser.contexts()[0] : await chromium.launchPersistentContext(profile, {
  executablePath: process.env.CAPTURE_BROWSER ?? "/usr/bin/chromium",
  headless: false,
  ignoreDefaultArgs: ["--disable-extensions", "--disable-component-extensions-with-background-pages"],
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: videoDir, size: { width: 480, height: 720 } },
  args: [
    ...(!installedExtensionId ? [
      `--disable-extensions-except=${root}/dist`,
      `--load-extension=${root}/dist`,
    ] : []),
    "--no-first-run",
    `--ozone-platform=${ozonePlatform}`,
    "--enable-unsafe-extension-debugging",
    "--disable-features=Translate",
    "--enable-features=PromptAPIForGeminiNano,PromptAPIForGeminiNanoMultimodalInput",
  ],
});
if (!context) throw new Error("Chrome's CDP connection has no default browser context.");
let capture;
try {
  const fixture = context.pages().find((page) => page.url().includes("/parcel-fee.html"))
    ?? context.pages()[0] ?? await context.newPage();
  await fixture.goto(`http://127.0.0.1:${port}/parcel-fee.html`);
  let cdpInstall;
  if (browser) {
    const session = await browser.newBrowserCDPSession();
    const { extensions } = await session.send("Extensions.getExtensions");
    if (!extensions.some((extension) => extension.id === installedExtensionId && extension.enabled))
      cdpInstall = await session.send("Extensions.loadUnpacked", { path: resolve(root, "dist") });
  }
  const id = cdpInstall?.id ?? installedExtensionId ?? new URL((context.serviceWorkers()[0]
    ?? await context.waitForEvent("serviceworker", { timeout: 15000 })).url()).hostname;
  if (installedExtensionId && id !== installedExtensionId) throw new Error(`Unexpected extension ID: ${id}`);
  const panelUrl = `chrome-extension://${id}/sidepanel.html`;
  let panel;
  if (browser) {
    let panels = context.pages().filter((page) => page.url() === panelUrl);
    if (panels.length < 2) {
      const helper = panels[0] ?? await context.newPage();
      if (helper.url() !== panelUrl) await helper.goto(panelUrl);
      await helper.evaluate(() => {
        const button = document.createElement("button");
        button.id = "demo-open-native-panel";
        button.addEventListener("click", async () =>
          chrome.sidePanel.open({ windowId: (await chrome.windows.getCurrent()).id }));
        document.body.append(button);
      });
      await helper.locator("#demo-open-native-panel").click();
      for (let attempt = 0; attempt < 20; attempt++) {
        panels = context.pages().filter((page) => page.url() === panelUrl);
        if (panels.length > 1) break;
        await new Promise((done) => setTimeout(done, 500));
      }
    }
    if (panels.length < 2) throw new Error("Could not open the native Chrome side panel.");
    panel = panels.at(-1);
  } else {
    panel = await context.newPage();
    await panel.setViewportSize({ width: 480, height: 720 });
    await panel.goto(panelUrl);
  }
  if (browser && await panel.evaluate(() => window.innerWidth) !== 360)
    throw new Error("The captured target is not Chrome's native 360px side panel.");
  // Reset the count only in this throwaway test profile, so the capture shows these two calls.
  await panel.evaluate(() => chrome.storage.local.set({ ledger: { local: 0, cloud: 0 } }));
  await panel.reload();
  await fixture.bringToFront();
  const [active] = await panel.evaluate(() => chrome.tabs.query({ active: true, currentWindow: true }));
  if (!active?.url?.startsWith(`http://127.0.0.1:${port}/`)) throw new Error("The synthetic fixture is not the active tab.");
  capture = browser ? await screenshotRecorder(panel) : null;
  const recording = browser ? null : panel.video();
  const start = performance.now();
  const at = capture?.at ?? (() => +((performance.now() - start) / 1000).toFixed(2));
  const timings = { started: at() };
  await new Promise((done) => setTimeout(done, 1500));
  if (!(await panel.locator("#enable").isVisible())) throw new Error("This browser did not offer private screening.");
  timings.enableClicked = at();
  // A trusted click starts the browser's model setup. Restore the fixture as
  // the active tab before the extension's automatic check reads its content.
  await panel.locator("#enable").click();
  await fixture.bringToFront();
  const [enabledTab] = await panel.evaluate(() => chrome.tabs.query({ active: true, currentWindow: true }));
  if (!enabledTab?.url?.startsWith(`http://127.0.0.1:${port}/`))
    throw new Error("The synthetic fixture was not active after enabling private screening.");
  try {
    await panel.waitForFunction(() =>
      (document.getElementById("setup").hidden
        && document.getElementById("mode").textContent.startsWith("Automatic checks run on this computer."))
      || (!document.getElementById("enable").disabled
        && document.getElementById("setup-text").textContent.includes("isn't available")),
    null, { timeout: 180000 });
  } catch (error) {
    const state = await panel.evaluate(() => ({
      setupText: document.getElementById("setup-text").textContent,
      mode: document.getElementById("mode").textContent,
      enableDisabled: document.getElementById("enable").disabled,
    }));
    throw new Error(`Private model did not become ready: ${JSON.stringify(state)}`, { cause: error });
  }
  if (!(await panel.locator("#setup").evaluate((element) => element.hidden))) {
    const message = await panel.locator("#setup-text").textContent();
    throw new Error(`Private model did not become ready: ${message}`);
  }
  timings.localReady = at();
  await panel.waitForFunction(() =>
    document.getElementById("verdict").dataset.risk !== "idle"
      || document.getElementById("headline").textContent === "I couldn't check this page.",
  null, { timeout: 70000 });
  timings.checkResult = at();
  const firstCheck = {
    site: await panel.locator("#site").textContent(),
    headline: await panel.locator("#headline").textContent(),
    source: await panel.locator("#source").textContent(),
    risk: await panel.locator("#verdict").getAttribute("data-risk"),
    mode: await panel.locator("#mode").textContent(),
  };
  if (!firstCheck.source?.includes("was checked on this computer."))
    throw new Error(`The first check was not confirmed on-device: ${JSON.stringify(firstCheck)}`);
  if (firstCheck.site !== "127.0.0.1")
    throw new Error(`The first check did not inspect the local fixture: ${JSON.stringify(firstCheck)}`);
  if (firstCheck.risk !== "suspicious")
    throw new Error(`The synthetic parcel page was not flagged: ${JSON.stringify(firstCheck)}`);
  if (!(await panel.locator("#second").isVisible())) throw new Error("No second opinion button after check");
  await panel.evaluate(() => document.getElementById("source").scrollIntoView({ block: "center", behavior: "smooth" }));
  timings.sourceScrolled = at();
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
    modelAvailability: await panel.evaluate(async () => {
      try {
        return typeof LanguageModel === "undefined" ? "unavailable" : await LanguageModel.availability();
      } catch {
        return "availability query failed";
      }
    }),
    fixture: "Synthetic local parcel-fee.html; no real scam website opened",
    capture: `${browser ? "CDP screenshot recording of Chrome's native extension side panel" : "Playwright video recording of the extension tab"} while the synthetic fixture tab remained active; trusted enable click and requested second-opinion button action against the real extension DOM`,
    timings,
    check: firstCheck,
    secondOpinion: {
      note: await panel.locator("#opinion-source-note").textContent(),
      text: await panel.locator("#opinion-text").textContent(),
      links: await panel.locator("#opinion-source-list a").count(),
    },
  };
  const rawVideo = capture ? await capture.stop() : await recording.path();
  if (!browser) await context.close();
  await copyFile(rawVideo, resolve(root, "demo/extension-check-on-device.webm"));
  await writeFile(resolve(root, "demo/extension-check-on-device.json"), JSON.stringify(observation, null, 2) + "\n");
  console.log("Recorded demo/extension-check-on-device.webm and demo/extension-check-on-device.json");
} finally {
  if (capture) await capture.stop().catch(() => {});
  if (!browser && context.browser()?.isConnected()) await context.close();
  await new Promise((done) => server.close(done));
}
// A CDP attachment otherwise holds Node's event loop open after the files are saved.
// The separately launched Chrome browser is left running for other tests.
if (browser) process.exit(0);
