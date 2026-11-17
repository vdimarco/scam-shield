import { loadRemoteConfig, settings } from "./firebase";
import { hasPromptApi, prepareLocalModel, screenPage, screenScreenshot, secondOpinion, type Verdict } from "./models";
import { opinionSourceNote } from "./opinion";
import { snapshotActiveTab, type PageSnapshot } from "./page";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const HEADLINES: Record<Verdict["risk"], string> = {
  safe: "No obvious scam signs found.",
  unsure: "Take care here.",
  suspicious: "Possible scam. Pause here.",
};

let localReady = false;
let current: { page: PageSnapshot | null; verdict: Verdict } | null = null;
let generation = 0;
let observedPage: string | null = null;
const ledger = { local: 0, cloud: 0 };
let ledgerSave = Promise.resolve();

async function bumpLedger(ranOnDevice: boolean | null) {
  if (ranOnDevice === null) return;
  ranOnDevice ? ledger.local++ : ledger.cloud++;
  $("ledger-local").textContent = String(ledger.local);
  $("ledger-cloud").textContent = String(ledger.cloud);
  ledgerSave = ledgerSave.catch(() => {}).then(() => chrome.storage.local.set({ ledger: { ...ledger } }));
  await ledgerSave;
}

function setMode() {
  $("mode").textContent = localReady
    ? "Automatic checks run on this computer. A manual check may use the cloud; each result shows where it ran."
    : "Automatic screening is off. A manual check may send page content to the cloud.";
}

function showStatus(headline: string, reason = "") {
  current = null;
  const card = $("verdict");
  card.dataset.risk = "idle";
  $("site").textContent = "";
  $("headline").textContent = headline;
  $("reason").textContent = reason;
  $("source").textContent = "";
  $("second").hidden = true;
  $<HTMLButtonElement>("second").disabled = false;
  $("opinion").hidden = true;
}

function showVerdict(page: PageSnapshot | null, verdict: Verdict) {
  current = { page, verdict };
  const checked = page ? "This page's content" : "This screenshot";
  $("verdict").dataset.risk = verdict.risk;
  $("site").textContent = page ? new URL(page.url).hostname : "Screenshot";
  $("headline").textContent = HEADLINES[verdict.risk];
  $("reason").textContent = verdict.reason;
  $("source").textContent = verdict.ranOnDevice === true
    ? `${checked} was checked on this computer.`
    : verdict.ranOnDevice === false
      ? `${checked} was sent to the cloud for this check.`
      : "The checking service did not report where this check ran.";
  $("second").hidden = !page;
  $<HTMLButtonElement>("second").disabled = false;
  $("opinion").hidden = true;
}

async function check(requested: boolean, knownPage?: PageSnapshot) {
  if (!requested && (!localReady || !settings.autoScreen())) return;
  if (requested) clearTimeout(timer);
  const request = ++generation;
  try {
    const page = knownPage ?? await snapshotActiveTab(settings.maxPageChars());
    if (request !== generation) return;
    if (!page) {
      observedPage = null;
      showStatus("I can't read this page.", "Chrome doesn't let extensions look at this kind of page.");
      return;
    }
    const snapshot = JSON.stringify(page);
    observedPage = snapshot;
    showStatus("Checking…");
    $("site").textContent = new URL(page.url).hostname;
    const verdict = await screenPage(page, { requested });
    void bumpLedger(verdict.ranOnDevice).catch((err) => console.warn("Scam Shield: could not save check count", err));
    if (request !== generation) return;
    const latest = await snapshotActiveTab(settings.maxPageChars());
    if (request !== generation) return;
    if (JSON.stringify(latest) !== snapshot) {
      observedPage = latest ? JSON.stringify(latest) : null;
      showStatus("This page changed during the check.", localReady && settings.autoScreen()
        ? "Checking the latest version."
        : "Check this page again before acting.");
      if (latest && localReady && settings.autoScreen()) void check(false, latest);
      return;
    }
    showVerdict(page, verdict);
  } catch (err) {
    if (request !== generation) return;
    console.error("Scam Shield: check failed", err);
    showStatus("I couldn't check this page.", "Try the Check this page button.");
  }
}

$("enable").addEventListener("click", async () => {
  const bar = $<HTMLProgressElement>("download");
  bar.hidden = false;
  $<HTMLButtonElement>("enable").disabled = true;
  try {
    await prepareLocalModel((fraction) => (bar.value = fraction));
    localReady = true;
    $("setup").hidden = true;
    setMode();
    void check(false);
  } catch (err) {
    console.error("Scam Shield: local model unavailable", err);
    $("setup-text").textContent =
      "This computer can't run the private checking model. You can still check any page with the button below.";
    bar.hidden = true;
  }
});

$("check").addEventListener("click", () => void check(true));

$("second").addEventListener("click", async () => {
  const checked = current;
  if (!checked?.page) return;
  const request = generation;
  const box = $("opinion");
  box.hidden = false;
  $("opinion-text").textContent = "Looking into it…";
  $("opinion-source-note").textContent = "";
  $("opinion-links").hidden = true;
  $("opinion-source-list").replaceChildren();
  const suggestions = $("search-suggestions");
  if (suggestions.shadowRoot) suggestions.shadowRoot.innerHTML = "";
  $<HTMLButtonElement>("second").disabled = true;
  try {
    const opinion = await secondOpinion(checked.page, checked.verdict);
    void bumpLedger(false).catch((err) => console.warn("Scam Shield: could not save check count", err));
    if (request !== generation || current !== checked) return;
    const textNodes: Node[] = [];
    let position = 0;
    for (const citation of [...opinion.citations].sort((a, b) => a.after - b.after)) {
      if (citation.after < position || citation.after > opinion.text.length) continue;
      textNodes.push(document.createTextNode(opinion.text.slice(position, citation.after)));
      for (const index of citation.sourceIndexes) {
        const source = opinion.sources[index];
        if (!source) continue;
        const link = document.createElement("a");
        link.textContent = ` [${index + 1}]`;
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        textNodes.push(link);
      }
      position = citation.after;
    }
    textNodes.push(document.createTextNode(opinion.text.slice(position)));
    $("opinion-text").replaceChildren(...textNodes);
    $("opinion-source-note").textContent = opinionSourceNote(opinion.searchFellBack, opinion.sources.length > 0);
    $("opinion-links").hidden = !opinion.sources.length;
    $("opinion-source-list").replaceChildren(...opinion.sources.map(({ title, url }, index) => {
      const link = document.createElement("a");
      link.textContent = title;
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      const item = document.createElement("li");
      item.append(document.createTextNode(`[${index + 1}] `), link);
      return item;
    }));
    if (opinion.searchSuggestions) {
      // The Firebase SDK supplies Google's required Search suggestions HTML and CSS.
      (suggestions.shadowRoot ?? suggestions.attachShadow({ mode: "open" })).innerHTML = opinion.searchSuggestions;
    }
  } catch (err) {
    if (request !== generation || current !== checked) return;
    console.error("Scam Shield: second opinion failed", err);
    $("opinion-text").textContent = "I couldn't reach the cloud. Check your connection and try again.";
  } finally {
    if (request === generation && current === checked) $<HTMLButtonElement>("second").disabled = false;
  }
});

$<HTMLInputElement>("shot").addEventListener("change", async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  clearTimeout(timer);
  const request = ++generation;
  observedPage = null;
  showStatus("Checking the screenshot…");
  $("site").textContent = "Screenshot";
  try {
    const verdict = await screenScreenshot(file);
    void bumpLedger(verdict.ranOnDevice).catch((err) => console.warn("Scam Shield: could not save check count", err));
    if (request !== generation) return;
    showVerdict(null, verdict);
  } catch (err) {
    if (request !== generation) return;
    console.error("Scam Shield: screenshot check failed", err);
    showStatus("I couldn't check that screenshot.", "Use a PNG or JPEG image.");
  }
});

// Automatic screening follows the active tab while the panel is open.
let timer: number | undefined;
const schedule = () => {
  ++generation;
  observedPage = null;
  clearTimeout(timer);
  showStatus(localReady && settings.autoScreen()
    ? "Page changed. Checking…"
    : "Page changed. Check this page when you're ready.");
  timer = window.setTimeout(() => void check(false), 800);
};
chrome.tabs.onActivated.addListener(schedule);
chrome.tabs.onUpdated.addListener((_id, change, tab) => {
  if (tab.active && (change.status === "loading" || change.status === "complete" || change.url)) schedule();
});

// Recheck only when the page itself changes without a tab navigation event.
window.setInterval(async () => {
  if (observedPage === null) return;
  const request = generation;
  try {
    const page = await snapshotActiveTab(settings.maxPageChars());
    if (request !== generation) return;
    const snapshot = page ? JSON.stringify(page) : null;
    if (snapshot === observedPage) return;
    ++generation;
    observedPage = snapshot;
    showStatus(localReady && settings.autoScreen()
      ? "This page changed. Checking again…"
      : "This page changed. Check it again before acting.");
    if (page && localReady && settings.autoScreen()) void check(false, page);
  } catch (err) {
    console.warn("Scam Shield: could not watch page changes", err);
  }
}, 3000);

async function start() {
  const stored = await chrome.storage.local.get("ledger");
  Object.assign(ledger, stored.ledger ?? {});
  $("ledger-local").textContent = String(ledger.local);
  $("ledger-cloud").textContent = String(ledger.cloud);
  await loadRemoteConfig();
  setMode();
  const setup = $("setup");
  setup.hidden = false;
  if (!hasPromptApi()) {
    $("setup-text").textContent =
      "This browser can't run the private checking model. You can still check any page with the button below.";
    $("enable").hidden = true;
  }
}

void start();
