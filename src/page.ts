export interface PageSnapshot {
  url: string;
  title: string;
  text: string;
  truncated: boolean;
  asksForPassword: boolean;
  asksForCard: boolean;
  formsPostElsewhere: number;
  mismatchedLinks: number;
}

export interface ActivePageSnapshot extends PageSnapshot {
  tabId: number;
}

export function describe(page: PageSnapshot): string {
  const address = new URL(page.url);
  // Query parameters and fragments can contain private tokens.
  return [
    `Address: ${`${address.origin}${address.pathname}`.slice(0, 2048)}`,
    `Title: ${page.title.slice(0, 500)}`,
    `Asks for a password: ${page.asksForPassword}`,
    `Asks for card details: ${page.asksForCard}`,
    `Forms that send data to another site: ${page.formsPostElsewhere}`,
    `Links that show one address but go to another: ${page.mismatchedLinks}`,
    `Page text coverage: ${page.truncated ? "partial; some content was omitted" : "complete"}`,
    `Page text:\n${page.text}`,
  ].join("\n");
}

/** Runs inside the page. Must be self-contained: Chrome serializes it. */
export function collect(maxChars: number): PageSnapshot {
  const limit = Number.isFinite(maxChars) && maxChars > 0 ? Math.max(1, Math.min(12_000, Math.trunc(maxChars))) : 12_000;
  const host = location.hostname;
  const inputs = Array.from(document.querySelectorAll("input"));
  const hint = (el: HTMLInputElement) => `${el.name} ${el.id} ${el.autocomplete} ${el.placeholder}`.toLowerCase();
  const text = (document.body?.innerText ?? "").replace(/\s+\n/g, "\n");

  let formsPostElsewhere = 0;
  for (const form of Array.from(document.forms)) {
    try {
      if (form.action && new URL(form.action, location.href).hostname !== host) formsPostElsewhere++;
    } catch {
      /* ignore malformed action */
    }
  }

  // Links whose visible text looks like one address but which go to another.
  let mismatchedLinks = 0;
  for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]")).slice(0, 400)) {
    const shown = a.textContent?.trim().match(/^(?:https?:\/\/)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i)?.[1];
    if (!shown) continue;
    try {
      const real = new URL(a.href).hostname.replace(/^www\./, "");
      const expected = shown.toLowerCase().replace(/^www\./, "");
      if (real !== expected && !real.endsWith(`.${expected}`)) mismatchedLinks++;
    } catch {
      /* ignore */
    }
  }

  return {
    url: location.href,
    title: document.title,
    text: text.slice(0, limit),
    truncated: text.length > limit,
    asksForPassword: inputs.some((i) => i.type === "password"),
    asksForCard: inputs.some((i) => /cc-|card|cvv|cvc/.test(hint(i))),
    formsPostElsewhere,
    mismatchedLinks,
  };
}

/** Reads the active tab. Returns null for pages Chrome won't let us read. */
export async function snapshotActiveTab(maxChars: number): Promise<ActivePageSnapshot | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) return null;
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: collect,
      args: [maxChars],
    });
    const page = result?.result as PageSnapshot | undefined;
    return page ? { ...page, tabId: tab.id } : null;
  } catch {
    return null;
  }
}

/** Runs inside the checked page. Chrome serializes this function. */
export function renderWarning(expectedUrl: string, reason: string | null): void {
  if (location.href !== expectedUrl) return;
  document.getElementById("scam-shield-warning")?.remove();
  if (!reason) return;

  const host = document.createElement("aside");
  host.id = "scam-shield-warning";
  host.setAttribute("role", "alert");
  host.setAttribute("aria-label", "Scam Shield warning");
  host.style.cssText = "all:initial;box-sizing:border-box;position:fixed;top:16px;right:16px;width:min(360px,calc(100vw - 32px));max-height:70vh;overflow:auto;z-index:2147483647;padding:16px;border:2px solid #a3271c;border-radius:12px;background:#fffdf8;color:#1f2a2e;box-shadow:0 12px 36px #0005;font:16px/1.45 system-ui,sans-serif;";
  const shadow = host.attachShadow({ mode: "closed" });
  const title = document.createElement("strong");
  title.textContent = "Scam Shield: Possible scam. Pause here.";
  title.style.cssText = "display:block;margin-bottom:8px;color:#a3271c;font-size:18px;";
  const detail = document.createElement("p");
  detail.textContent = reason;
  detail.style.cssText = "margin:0 0 8px;";
  const step = document.createElement("p");
  step.textContent = "Before paying or sharing details, verify through the official app or a number you found independently.";
  step.style.cssText = "margin:0 0 12px;";
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.textContent = "Dismiss warning";
  dismiss.style.cssText = "padding:8px 12px;border:1px solid #1f2a2e;border-radius:6px;background:#fffdf8;color:#1f2a2e;font:600 14px system-ui,sans-serif;cursor:pointer;";
  dismiss.addEventListener("click", () => host.remove());
  shadow.append(title, detail, step, dismiss);
  // Keep the extension warning outside body.innerText so it cannot contaminate the next scan.
  document.documentElement.append(host);
}

/** Shows a warning only on the tab whose URL still matches the checked page. */
export async function setTabWarning(tabId: number, pageUrl: string, reason: string | null): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== tabId || tab.url !== pageUrl) return;
  await chrome.action.setBadgeText({ tabId: tab.id, text: reason ? "!" : "" });
  if (reason) await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#a3271c" });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: renderWarning,
    args: [pageUrl, reason],
  });
}
