import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(readFileSync(join(here, "cases.json"), "utf8"));
const byId = new Map(cases.map((item) => [item.id, item]));
if (byId.size !== cases.length || cases.some((item) => !["safe", "suspicious"].includes(item.expected) || !existsSync(join(here, "fixtures", item.file)))) {
  throw new Error("Case IDs, labels, or fixture files are invalid.");
}

const csvPath = resolve(process.argv[2] ?? join(here, "results.csv"));
const lines = readFileSync(csvPath, "utf8").trimEnd().split(/\r?\n/);
const header = "case_id,run,mode,observed_risk,inference_source";
if (lines.shift() !== header) throw new Error(`Expected CSV header: ${header}`);
if (lines.length === 0) {
  console.log("No observed results yet. Record actual side-panel verdicts in evaluation/results.csv.");
  process.exit(0);
}

const seen = new Set();
const groups = new Map();
for (const [index, line] of lines.entries()) {
  const fields = line.split(",").map((part) => part.trim());
  if (fields.length !== 5) throw new Error(`Line ${index + 2}: expected five comma-free fields.`);
  const [id, run, mode, observed, source] = fields;
  if (!byId.has(id) || !/^[1-9]\d*$/.test(run) || !["automatic", "requested"].includes(mode) ||
      !["safe", "unsure", "suspicious", "error"].includes(observed) ||
      !["on-device", "cloud", "unknown"].includes(source) ||
      (mode === "automatic" && source === "cloud") || (source === "unknown" && observed !== "error")) {
    throw new Error(`Line ${index + 2}: invalid case, run, mode, verdict, or source.`);
  }
  const key = `${id}/${run}/${mode}/${source}`;
  if (seen.has(key)) throw new Error(`Line ${index + 2}: duplicate ${key}.`);
  seen.add(key);
  const groupKey = `${mode} / ${source}`;
  const group = groups.get(groupKey) ?? { attempts: 0, suspicious: 0, safe: 0, caught: 0, misses: 0, falseAlarms: 0, unsure: 0, errors: 0, caseIds: new Set() };
  group.attempts++;
  group.caseIds.add(id);
  if (byId.get(id).expected === "suspicious") {
    group.suspicious++;
    if (observed === "suspicious") group.caught++;
    if (observed === "safe") group.misses++;
  } else {
    group.safe++;
    if (observed === "suspicious") group.falseAlarms++;
  }
  if (observed === "unsure") group.unsure++;
  if (observed === "error") group.errors++;
  groups.set(groupKey, group);
}

console.log(`Synthetic fixture cases: ${cases.length}. These counts are not real-world accuracy estimates.`);
for (const [name, group] of groups) {
  console.log(`\n${name}: ${group.attempts} attempts across ${group.caseIds.size}/${cases.length} cases`);
  console.log(`  Suspicious caught: ${group.caught}/${group.suspicious}; suspicious shown safe: ${group.misses}/${group.suspicious}`);
  console.log(`  Legitimate false alarms: ${group.falseAlarms}/${group.safe}; unsure: ${group.unsure}; errors: ${group.errors}`);
}
