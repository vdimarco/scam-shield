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

/** Runs inside the page. Must be self-contained: Chrome serializes it. */
export function collect(maxChars: number): PageSnapshot {
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
    text: text.slice(0, maxChars),
    truncated: text.length > maxChars,
    asksForPassword: inputs.some((i) => i.type === "password"),
    asksForCard: inputs.some((i) => /cc-|card|cvv|cvc/.test(hint(i))),
    formsPostElsewhere,
    mismatchedLinks,
  };
}

/** Reads the active tab. Returns null for pages Chrome won't let us read. */
export async function snapshotActiveTab(maxChars: number): Promise<PageSnapshot | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) return null;
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: collect,
      args: [maxChars],
    });
    return (result?.result as PageSnapshot | undefined) ?? null;
  } catch {
    return null;
  }
}
