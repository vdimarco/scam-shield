// The service worker only opens the side panel. All inference runs in the
// side panel document, because Chrome's Prompt API needs a document context.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error("Scam Shield: could not set panel behavior", err));
