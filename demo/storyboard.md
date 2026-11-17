# Scam Shield: narrated judge video plan (about 100 seconds)

The [current 88-second candidate](scam-shield-judge-candidate.mp4) is a silent, English-captioned
composite of observed screenshots. This plan describes a possible narrated follow-up recording.

**Story:** I worry about my grandmother getting a parcel message that asks for a small fee and her card number. The notice, company, and older-adult portrait are illustrative; this is not a real incident or a photograph of my grandmother. Scam Shield gives her a calm reason to pause and a safer way to check.

| Time | Visual to record | Narration |
| --- | --- | --- |
| 0:00–0:15 | Show the illustrative older-adult portrait, then the visibly labelled [fictional parcel page](../evaluation/fixtures/parcel-fee.html). Zoom on the 30-minute deadline, $1.95 fee, and card field. | “I built Scam Shield thinking about my grandmother. A message like this could make her enter her card details before she has time to check.” |
| 0:15–0:40 | Show a real check in the [hosted web demo](https://scam-shield-landing-phi.vercel.app/). Keep the result and **Inference source: on this device** label readable. If using the [captured proof](hosted-on-device-proof.png) rather than fresh footage, label it as a screenshot of an observed run. | “Here, Firebase AI Logic checked the fictional message in Chrome’s on-device model. It flagged the urgency and card request, and the checked text stayed in this browser.” |
| 0:40–1:05 | Show the real extension beside the fictional parcel page. Click **Check this page** and keep the verdict, reason, and **sent to the cloud** label on screen together. Use the [38-second silent composite](scam-shield-real-check.mp4) only as supplemental evidence, not as this live sequence. | “The Chrome extension gives the same calm pause while she browses. On this test computer, the private model was unavailable, so this requested check used Firebase AI Logic in the cloud. The panel says where the check ran.” |
| 1:05–1:20 | Show the legitimate parcel fixture and its **No obvious scam signs found** result, then a compact scorecard: 4/4 synthetic suspicious pages flagged; 0/4 synthetic legitimate pages falsely flagged. | “We also checked ordinary pages. In one small synthetic run, it flagged four suspicious pages and falsely flagged none of four ordinary pages. That is a test result, not a real-world accuracy claim.” |
| 1:20–1:35 | Show a simple route diagram with `ONLY_ON_DEVICE` automatic screening, `PREFER_ON_DEVICE` requested checks, and the observed source labels. | “The design keeps routine screening on the device when the model is available, and lets the person request a check when it is not.” |
| 1:35–1:45 | End on Grandma’s safe next step: close the page, open the official delivery app, or call a saved number. Add a small limitation note. | “She can stop, leave the page, and verify through a contact she already trusts. Grounded web lookup is still unverified: our Google Search request hit the project quota during testing.” |

## Recording rules

- Film the actual product state and source label for each result. The hosted **web demo** has an observed on-device run; do not imply the **extension** was observed running on-device. Label screenshots and composites as such.
- Keep the synthetic page and illustrative portrait labelled. Do not present either as a real scam or a photograph of the creator’s grandmother.
- Do not show a successful grounded second opinion unless a fresh run succeeds and displays its real sources. The recorded attempt returned HTTP 429; [the observation](../evaluation/second-opinion-observation.json) documents it.
- Keep private tokens, personal messages, and browsing history out of frame. Use readable zoom, English narration and captions, and a public YouTube video under three minutes for Devpost.
