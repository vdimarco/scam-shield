// The service worker only opens the side panel. All inference runs in the
// side panel document, because Chrome's Prompt API needs a document context.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error("Scam Shield: could not set panel behavior", err));

chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === "loading" || change.url) {
    void chrome.action.setBadgeText({ tabId, text: "" })
      .catch((err) => console.warn("Scam Shield: could not clear warning badge", err));
  }
  if (change.url) {
    void chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.getElementById("scam-shield-warning")?.remove(),
    }).catch(() => {});
  }
});
