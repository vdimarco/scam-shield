import { prepareLocalModel, screenPage } from "../src/models";
import { errorType, outcomeFromVerdict, parseDataset, summarize, type Case, type Outcome } from "./local-runner-logic";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fileInput = $<HTMLInputElement>("dataset");
const prepareButton = $<HTMLButtonElement>("prepare");
const runButton = $<HTMLButtonElement>("run");
const exportButton = $<HTMLButtonElement>("export");
const status = $("status");
const progress = $<HTMLProgressElement>("download");
let cases: Case[] = [];
let outcomes: Outcome[] = [];
let localReady = false;
let running = false;
let runAt = "";

function render() {
  const body = $("results");
  body.replaceChildren(...outcomes.map((outcome) => {
    const row = document.createElement("tr");
    for (const value of [outcome.id.slice(0, 16), outcome.label, outcome.observedRisk, outcome.inferenceSource,
      outcome.elapsedMs === null ? "—" : `${outcome.elapsedMs} ms`,
      outcome.error ? `${outcome.error}${outcome.errorType ? ` (${outcome.errorType})` : ""}` : "—"]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  }));
  const summary = summarize(outcomes);
  $("summary").textContent = outcomes.length
    ? [`Local successes: ${summary.localSuccesses}/${outcomes.length}`,
       ...Object.entries(summary.byLabel).filter(([, counts]) => Object.values(counts).some(Boolean)).map(([label, counts]) =>
         `${label}: ${counts.suspicious} suspicious · ${counts.unsure} unsure · ${counts.safe} safe · ${counts.error} error`),
       `Sources: ${summary.sources["on-device"]} on-device · ${summary.sources.cloud} cloud · ${summary.sources.unknown} unknown`].join("\n")
    : "No checks yet.";
  exportButton.disabled = running || outcomes.length === 0;
}

fileInput.addEventListener("change", async () => {
  cases = [];
  outcomes = [];
  runAt = "";
  render();
  prepareButton.disabled = true;
  runButton.disabled = true;
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    if (file.size > 3_000_000) throw new Error("The snapshot file is too large (3 MB maximum).");
    cases = parseDataset(JSON.parse(await file.text()));
    status.textContent = `${cases.length} inert snapshots loaded. Prepare the local model to continue.`;
    prepareButton.disabled = localReady;
    runButton.disabled = !localReady;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Could not read the snapshot file.";
  }
});

prepareButton.addEventListener("click", async () => {
  prepareButton.disabled = true;
  progress.hidden = false;
  fileInput.disabled = true;
  status.textContent = "Preparing the on-device model. The first download may take several minutes…";
  try {
    await prepareLocalModel((fraction) => { progress.value = fraction; });
    localReady = true;
    status.textContent = "Local model ready. Run the checks.";
    runButton.disabled = false;
  } catch (error) {
    localReady = false;
    runAt = new Date().toISOString();
    status.textContent = "The local model is unavailable in this browser. No cloud check ran. Check Chrome Prompt API availability, storage, and flags.";
    outcomes = cases.map(({ id, label, expectedRisk, category }) => ({ id, label, expectedRisk, category,
      observedRisk: "error", inferenceSource: "unknown", error: "local-model-unavailable", errorType: errorType(error), elapsedMs: null }));
    render();
    prepareButton.disabled = false;
  } finally {
    progress.hidden = true;
    fileInput.disabled = false;
  }
});

runButton.addEventListener("click", async () => {
  running = true;
  runAt = new Date().toISOString();
  fileInput.disabled = true;
  runButton.disabled = true;
  prepareButton.disabled = true;
  outcomes = [];
  render();
  for (const [index, sample] of cases.entries()) {
    status.textContent = `Checking ${index + 1}/${cases.length} locally…`;
    let outcome: Outcome;
    const started = performance.now();
    try {
      const verdict = await screenPage(sample.page, { requested: false });
      outcome = outcomeFromVerdict(sample, verdict, Math.round(performance.now() - started));
    } catch (error) {
      outcome = { id: sample.id, label: sample.label, expectedRisk: sample.expectedRisk, category: sample.category,
        observedRisk: "error", inferenceSource: "unknown", error: "inference-failed", errorType: errorType(error),
        elapsedMs: Math.round(performance.now() - started) };
    }
    outcomes.push(outcome);
    render();
  }
  status.textContent = `Finished ${cases.length} checks. Download the result file for review.`;
  running = false;
  render();
  fileInput.disabled = false;
  runButton.disabled = false;
});

exportButton.addEventListener("click", () => {
  const report = { runAt, mode: "ONLY_ON_DEVICE", cases: outcomes, summary: summarize(outcomes) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `scam-shield-local-results-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});
