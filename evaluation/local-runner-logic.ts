import type { PageSnapshot } from "../src/page";
import type { Verdict } from "../src/verdict";

export interface Case {
  id: string;
  label: "phish" | "scam" | "benign";
  expectedRisk: "suspicious" | "safe";
  category?: string;
  page: PageSnapshot;
}

export interface Outcome {
  id: string;
  label: Case["label"];
  expectedRisk: Case["expectedRisk"];
  category?: string;
  observedRisk: "suspicious" | "unsure" | "safe" | "error";
  inferenceSource: "on-device" | "cloud" | "unknown";
  error: "local-model-unavailable" | "inference-failed" | "nonlocal-source" | "deadline-exceeded" | null;
  errorType?: string;
  elapsedMs: number | null;
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const count = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0;

export function errorType(error: unknown): string {
  if (!object(error)) return "UnknownError";
  const name = typeof error.name === "string" && /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(error.name)
    ? error.name : "UnknownError";
  const code = typeof error.code === "string" && /^[A-Za-z0-9._/-]{1,60}$/.test(error.code)
    ? `/${error.code}` : "";
  return name + code;
}

export function parseDataset(value: unknown): Case[] {
  if (!object(value) || !Array.isArray(value.cases) || value.cases.length < 1 || value.cases.length > 200) {
    throw new Error("Expected 1–200 cases in a cases array.");
  }
  const ids = new Set<string>();
  return value.cases.map((raw: unknown, index: number) => {
    if (!object(raw) || typeof raw.id !== "string" || !/^[a-zA-Z0-9._/-]{1,128}$/.test(raw.id) || ids.has(raw.id) ||
        !["phish", "scam", "benign"].includes(String(raw.label)) || !object(raw.page) ||
        (raw.category !== undefined && (typeof raw.category !== "string" || !/^[a-zA-Z0-9_-]{1,40}$/.test(raw.category)))) {
      throw new Error(`Case ${index + 1} has an invalid or duplicate ID, label, or page.`);
    }
    const expectedRisk = raw.label === "benign" ? "safe" : "suspicious";
    if (raw.expectedRisk !== undefined && raw.expectedRisk !== expectedRisk) {
      throw new Error(`Case ${index + 1} has a label that conflicts with expectedRisk.`);
    }
    const page = raw.page;
    if (typeof page.url !== "string" || page.url.length > 2048 || !/^https?:\/\//.test(page.url) ||
        typeof page.title !== "string" || page.title.length > 500 ||
        typeof page.text !== "string" || page.text.length > 12000 ||
        typeof page.truncated !== "boolean" || typeof page.asksForPassword !== "boolean" ||
        typeof page.asksForCard !== "boolean" || !count(page.formsPostElsewhere) || !count(page.mismatchedLinks)) {
      throw new Error(`Case ${index + 1} is not a bounded PageSnapshot.`);
    }
    ids.add(raw.id);
    return { id: raw.id, label: raw.label as Case["label"], expectedRisk,
      ...(raw.category === undefined ? {} : { category: raw.category as string }), page: page as unknown as PageSnapshot };
  });
}

export function outcomeFromVerdict(sample: Case, verdict: Verdict, elapsedMs: number): Outcome {
  const inferenceSource = verdict.ranOnDevice === true ? "on-device" : verdict.ranOnDevice === false ? "cloud" : "unknown";
  return { id: sample.id, label: sample.label, expectedRisk: sample.expectedRisk, category: sample.category,
    observedRisk: inferenceSource === "on-device" ? verdict.risk : "error", inferenceSource,
    error: inferenceSource === "on-device" ? null : "nonlocal-source", elapsedMs };
}

export function summarize(outcomes: Outcome[]) {
  const byLabel = {
    phish: { suspicious: 0, unsure: 0, safe: 0, error: 0 },
    scam: { suspicious: 0, unsure: 0, safe: 0, error: 0 },
    benign: { suspicious: 0, unsure: 0, safe: 0, error: 0 },
  };
  const sources = { "on-device": 0, cloud: 0, unknown: 0 };
  let localSuccesses = 0;
  for (const outcome of outcomes) {
    byLabel[outcome.label][outcome.observedRisk]++;
    sources[outcome.inferenceSource]++;
    if (outcome.inferenceSource === "on-device" && outcome.observedRisk !== "error") localSuccesses++;
  }
  return { byLabel, sources, localSuccesses };
}
