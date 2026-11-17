# Scam Shield: three-minute demo plan

**Story:** A fictional parcel notice arrives while someone is helping their grandmother. The aim is to give her a calm pause, a reason she can understand, and a way to verify before sharing card details. Do not present the synthetic page or generated landing-page portrait as a real incident or as a photograph of your grandmother.

| Time | Real footage / visual | Spoken line (adapt to what the live run shows) |
| --- | --- | --- |
| 0:00–0:20 | Show the local, visibly labelled synthetic [`parcel-fee.html`](../evaluation/fixtures/parcel-fee.html). Zoom on the 30-minute deadline, $1.95 fee, card field, and link text. | “Imagine my grandmother seeing this parcel notice. The small fee looks routine, but the timer pushes her to act before she can check it.” |
| 0:20–0:40 | Open the actual Chrome extension side panel beside the page. Show the calm layout and the **Check this page** button. | “Scam Shield gives her a moment to stop and a plain-language explanation.” |
| 0:40–1:10 | Run an **actual** check. Capture the resulting risk, reason, tactics, and source label in one uncut sequence. If private screening was enabled, show its setup first and let the automatic scan finish. | “Here is what the extension found: [read the real verdict and reason]. This check ran [read the real source label].” |
| 1:10–1:30 | Show the safe next step as a title card: close the page; call the delivery company through a saved number or official app. | “She can leave the page and use a contact she already trusts. She stays in control.” |
| 1:30–1:55 | If the first verdict is not `safe`, click **Get a second opinion** and show the real response. Wait for completion; do not cut a failure into a success. | “When she asks for a second opinion, that one page goes to the cloud for a deeper look. The first pass did not need to send her browsing there.” |
| 1:55–2:20 | Show a simple three-step diagram alongside short code excerpts from `src/models.ts`: `ONLY_ON_DEVICE` for automatic screening, `PREFER_ON_DEVICE` for requested checks, `ONLY_IN_CLOUD` plus Google Search for the second opinion. | “Firebase AI Logic routes each step to the right place: private routine checks on the device, a requested fallback when needed, and a grounded cloud check only after a deliberate tap.” |
| 2:20–2:40 | Show a **real** requested check in a Chrome environment without the local model, if available. Otherwise show the code path and say it is a designed fallback, without implying it was filmed running. | “On a device without the local model, she can still request a check. The panel identifies where it ran.” |
| 2:40–2:55 | Show the evaluation table from `node evaluation/score.mjs` **only after real runs are recorded**. Include suspicious misses and legitimate false alarms, not just catches. | “We tested a small synthetic set of scam and ordinary pages. Here are the observed results and the failures we are still improving.” |
| 2:55–3:00 | Return to the older-adult experience and project name. | “A pause and a clearer next step, when it matters.” |

## Before recording

- Use the live extension and synthetic local fixtures for product footage. Never use the Vercel landing page’s illustrative scan as proof of functionality.
- Capture the source label for every shown result. Do not call a requested check local until the label confirms it, and do not describe a second opinion as showing clickable citations unless the shipped UI actually displays them.
- Keep Firebase keys, App Check debug tokens, personal messages, and real browsing history out of the recording. Use a clean browser profile and a test Firebase project.
- Run the evaluation first. If the parcel fixture is missed or the cloud call fails, fix or honestly report that result before filming. Do not splice together different runs to imply one successful journey.
- Keep the final video under three minutes. Add captions, readable zoom, a public repository link, and a short setup note in the submission.
