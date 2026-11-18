import { createHash } from "node:crypto";
import { readFile, mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { errorType, outcomeFromVerdict, parseDataset, summarize } from "./local-runner-logic.ts";

const RUNNER_URL = "http://127.0.0.1:5178/evaluation/local-runner.html";
const CDP_URL = "http://127.0.0.1:9234";
const risks = ["safe", "unsure", "suspicious", "error"];
const sources = ["on-device", "cloud", "unknown"];
const errors = [null, "local-model-unavailable", "inference-failed", "nonlocal-source", "deadline-exceeded"];
const stages = ["navigation", "loaded", "instrumented", "instrumentation-failed", "api-unavailable", "module-import", "request-start", "session-create", "session-ready", "prompt-start", "prompt-ready", "prompt-error", "prompt-uninstrumented", "verdict-ready"];

// Use a fresh tab per case so closing it cancels a stuck Prompt API request.
async function localPage(context) {
  const page = await context.newPage();
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port === "5178"
      ? route.continue() : route.abort();
  });
  return page;
}

export async function runCase(context, sample, deadlineMs) {
  const started = performance.now();
  const page = await localPage(context);
  const deadlineError = new Error("Case deadline exceeded");
  const trace = { lastStage: "navigation", sessionCreateMs: null, promptMs: null };
  let sessionStarted;
  let promptStarted;
  page.on("console", (message) => {
    const stage = message.text().match(/^ScamShieldDiagnostic:([a-z-]+)$/)?.[1];
    if (!stages.includes(stage)) return;
    trace.lastStage = stage;
    if (stage === "session-create") sessionStarted = performance.now();
    if (stage === "session-ready" && sessionStarted !== undefined) trace.sessionCreateMs = Math.round(performance.now() - sessionStarted);
    if (stage === "prompt-start") promptStarted = performance.now();
    if ((stage === "prompt-ready" || stage === "prompt-error") && promptStarted !== undefined) trace.promptMs = Math.round(performance.now() - promptStarted);
  });
  let timer;
  let outcome;
  try {
    const operation = (async () => {
      await page.goto(RUNNER_URL, { waitUntil: "domcontentloaded", timeout: 10_000 });
      trace.lastStage = "loaded";
      return page.evaluate(async (snapshot) => {
        const emit = (stage) => console.info(`ScamShieldDiagnostic:${stage}`);
        const provider = globalThis.LanguageModel;
        if (typeof provider?.create === "function") {
          const create = provider.create;
          try {
            provider.create = async function (...args) {
              emit("session-create");
              const session = await create.apply(this, args);
              emit("session-ready");
              const prompt = session.prompt;
              if (typeof prompt === "function") {
                const wrapped = async function (...promptArgs) {
                  emit("prompt-start");
                  try {
                    const result = await prompt.apply(this, promptArgs);
                    emit("prompt-ready");
                    return result;
                  } catch (error) {
                    emit("prompt-error");
                    throw error;
                  }
                };
                try {
                  session.prompt = wrapped;
                  if (session.prompt !== wrapped) emit("prompt-uninstrumented");
                } catch { emit("prompt-uninstrumented"); }
              }
              return session;
            };
            emit(provider.create === create ? "instrumentation-failed" : "instrumented");
          } catch { emit("instrumentation-failed"); }
        } else emit("api-unavailable");
        emit("module-import");
        const { screenPage } = await import("/src/models.ts");
        emit("request-start");
        const verdict = await screenPage(snapshot, { requested: false });
        emit("verdict-ready");
        return { risk: verdict.risk, ranOnDevice: verdict.ranOnDevice };
      }, sample.page);
    })();
    const verdict = await Promise.race([
      operation,
      new Promise((_, reject) => { timer = setTimeout(() => reject(deadlineError), deadlineMs); }),
    ]);
    if (!verdict || !risks.slice(0, 3).includes(verdict.risk) || ![true, false, null].includes(verdict.ranOnDevice)) {
      throw new Error("Invalid local verdict");
    }
    outcome = outcomeFromVerdict(sample, { ...verdict, reason: "" }, Math.round(performance.now() - started));
  } catch (error) {
    outcome = {
      id: sample.id, label: sample.label, expectedRisk: sample.expectedRisk, category: sample.category,
      observedRisk: "error", inferenceSource: "unknown",
      error: error === deadlineError ? "deadline-exceeded" : "inference-failed",
      errorType: error === deadlineError ? "TimeoutError" : errorType(error),
      elapsedMs: Math.round(performance.now() - started),
    };
  } finally {
    clearTimeout(timer);
    await page.close({ runBeforeUnload: false });
    if (!page.isClosed()) throw new Error("Case tab did not close");
  }
  return { ...outcome, ...trace };
}

function resumeReport(saved, expected, samples) {
  if (!saved || saved.mode !== "ONLY_ON_DEVICE" || saved.datasetSha256 !== expected.datasetSha256 ||
      saved.deadlineMs !== expected.deadlineMs || saved.chromeVersion !== expected.chromeVersion ||
      typeof saved.runAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(saved.runAt) ||
      !Array.isArray(saved.cases) || saved.cases.length > samples.length) {
    throw new Error("Existing report does not match this dataset, deadline, or Chrome version.");
  }
  const cases = saved.cases.map((raw, index) => {
    const sample = samples[index];
    if (!raw || raw.id !== sample.id || raw.label !== sample.label || raw.expectedRisk !== sample.expectedRisk ||
        raw.category !== sample.category || !risks.includes(raw.observedRisk) || !sources.includes(raw.inferenceSource) ||
        !errors.includes(raw.error) || (raw.elapsedMs !== null && (!Number.isInteger(raw.elapsedMs) || raw.elapsedMs < 0)) ||
        (raw.errorType !== undefined && (typeof raw.errorType !== "string" ||
          !/^[A-Za-z][A-Za-z0-9]{0,39}(\/[A-Za-z0-9._/-]{1,60})?$/.test(raw.errorType))) ||
        (raw.lastStage !== undefined && !stages.includes(raw.lastStage)) ||
        [raw.sessionCreateMs, raw.promptMs].some((value) => value !== undefined && value !== null && (!Number.isInteger(value) || value < 0))) {
      throw new Error(`Existing report has invalid case ${index + 1}.`);
    }
    return {
      id: sample.id, label: sample.label, expectedRisk: sample.expectedRisk, category: sample.category,
      observedRisk: raw.observedRisk, inferenceSource: raw.inferenceSource, error: raw.error,
      ...(raw.errorType === undefined ? {} : { errorType: raw.errorType }), elapsedMs: raw.elapsedMs,
      ...(raw.lastStage === undefined ? {} : { lastStage: raw.lastStage, sessionCreateMs: raw.sessionCreateMs ?? null, promptMs: raw.promptMs ?? null }),
    };
  });
  return { ...expected, runAt: saved.runAt, cases, summary: summarize(cases) };
}

async function checkpoint(path, report) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  await rename(`${path}.tmp`, path);
}

async function ensureLocalModel(context) {
  const page = await localPage(context);
  try {
    await page.goto(RUNNER_URL, { waitUntil: "domcontentloaded", timeout: 10_000 });
    const availability = await page.evaluate(async () =>
      globalThis.LanguageModel?.availability ? globalThis.LanguageModel.availability() : "unavailable");
    if (availability !== "available") throw new Error("Local Chrome model is unavailable");
  } finally {
    await page.close({ runBeforeUnload: false });
  }
}

async function main() {
  const [inputArg, outputArg, deadlineArg = "60000", extra] = process.argv.slice(2);
  if (!inputArg || !outputArg || extra) {
    throw new Error("Usage: node evaluation/run-bounded-local.mjs SNAPSHOTS.json RESULTS.json [deadlineMs]");
  }
  const deadlineMs = Number(deadlineArg);
  if (!Number.isInteger(deadlineMs) || deadlineMs < 1_000 || deadlineMs > 300_000) {
    throw new Error("deadlineMs must be an integer from 1000 to 300000.");
  }
  const inputPath = resolve(inputArg);
  const outputPath = resolve(outputArg);
  if (inputPath === outputPath) throw new Error("Input and result paths must differ.");
  const bytes = await readFile(inputPath);
  if (bytes.length > 4_000_000) throw new Error("Snapshot file exceeds 4 MB.");
  let parsed;
  try { parsed = JSON.parse(bytes.toString("utf8")); }
  catch { throw new Error("Invalid snapshot JSON."); }
  const samples = parseDataset(parsed);
  const datasetSha256 = createHash("sha256").update(bytes).digest("hex");
  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 10_000 });
  try {
    const context = browser.contexts()[0];
    if (!context) throw new Error("No Chrome profile is attached to the CDP port.");
    const expected = { mode: "ONLY_ON_DEVICE", datasetSha256, deadlineMs, chromeVersion: browser.version() };
    let report;
    try { report = resumeReport(JSON.parse(await readFile(outputPath, "utf8")), expected, samples); }
    catch (error) {
      if (error?.code !== "ENOENT") throw error;
      report = { ...expected, runAt: new Date().toISOString(), cases: [], summary: summarize([]) };
    }
    if (report.cases.length === samples.length) {
      console.log(`Already complete: ${report.cases.length}/${samples.length} cases.`);
      return;
    }
    await ensureLocalModel(context);
    await checkpoint(outputPath, report);
    for (let index = report.cases.length; index < samples.length; index++) {
      const outcome = await runCase(context, samples[index], deadlineMs);
      report.cases.push(outcome);
      report.summary = summarize(report.cases);
      await checkpoint(outputPath, report);
      console.log(`${index + 1}/${samples.length}: ${outcome.observedRisk} · ${outcome.inferenceSource} · ${outcome.elapsedMs} ms`);
    }
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(`Benchmark stopped: ${errorType(error)}`); process.exitCode = 1; });
}
