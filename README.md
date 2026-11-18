# Scam Shield

A Chrome extension that screens the active page for scams while its side panel is open.
Automatic screening runs on the computer; cloud checks require a button tap.
When a private automatic check flags a page as suspicious, a dismissible warning appears
on that page and the extension icon shows a red alert badge. The warning is advisory;
screening and alerts require the side panel to stay open.

Built for #BuildHybridAI 2026 with the Firebase AI Logic hybrid inference SDK.

## Why hybrid

Routine page screening should not send browsing content to a server. Scam Shield uses the
on-device model for automatic checks while its panel is open. A small local model cannot look
anything up, so the design offers an optional cloud second opinion for flagged pages.

| Step | Inference mode | Why |
| --- | --- | --- |
| Automatic screening while the panel is open | `ONLY_ON_DEVICE` (Gemini Nano) | These checks keep page content on the computer |
| "Check this page" and screenshot checks | `PREFER_ON_DEVICE` | Can fall back to cloud after App Check is set up; the panel indicates which mode ran |
| "Get a second opinion" | `ONLY_IN_CLOUD`; attempts Google Search grounding | If search quota is unavailable, returns a cloud opinion based only on the page and says it has no web sources |

If a computer has no local model, automatic screening stays off rather than falling back to
the cloud. The footer counts pages checked locally and pages sent to the cloud while the panel
is open.

Other Firebase products: App Check (required, per-install debug provider for private judging) and Remote Config
(`cloud_model`, `auto_screen`, `max_page_chars`).

The routing lives in [src/models.ts](src/models.ts).

## Hosted web demo

The [public HTTPS demo](https://scam-shield-landing-phi.vercel.app/#try-it) lets anyone check a fictional sample message or their own short text with Firebase AI Logic. In supported desktop Chrome, **Prepare private model** downloads Chrome's built-in model before a separate `ONLY_ON_DEVICE` check. The other button uses `PREFER_ON_DEVICE` and may fall back to the cloud. Each result labels the reported inference source. The cloud route uses reCAPTCHA Enterprise App Check; remove personal details before choosing it. The parcel-page illustration above the checker is a sample display, not a scan result. The hosted checker does not install or replace the Chrome extension. Its source and build instructions are in [web-demo](web-demo/README.md).

On November 17, 2026, the hosted checker returned an [on-device verdict in Chrome 157](demo/hosted-on-device-proof.png) after the browser downloaded its local model. A later private-only check in a model-ready Chrome profile also completed while non-local page requests were blocked. The result explicitly said the checked text stayed in the browser. The extension's automatic path was separately verified against a synthetic local page in that profile on November 18.

## Run the private judge build

The public source includes the demo project's Firebase web config in `.env.example`. Firebase
web config identifies the app; it is not an App Check credential. The debug build generates a
different App Check token on each install, so there is no shared token in source or `dist/`.

1. `cp .env.example .env.local`, then `npm install` and `npm run build`.
   This is the same as `npm run build:judge`.
2. Use desktop Chrome 148+ with at least 22 GB free on the volume containing its profile for the initial model download. Chrome removes the model if free space later falls below 10 GB. For screenshot checks, enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` if Chrome does not already expose image input, then restart. [Chrome's requirements](https://developer.chrome.com/docs/ai/prompt-api) also call for an unmetered initial download.
3. Open `chrome://extensions`, turn on Developer mode, **Load unpacked**, pick `dist/`.
4. Click the extension icon to open the side panel. Right-click the panel, select **Inspect**,
   and privately send the generated `App Check debug token` shown in the console to the project
   owner. The owner registers it in the demo Firebase project under **Security > App Check >
   Apps > Manage debug tokens**. Reload the extension after the owner confirms registration.
5. Click **Turn on private screening** (downloads the local model once), then try the labelled
   synthetic examples linked from the landing page. The panel remembers this choice and resumes
   private screening on reopen when Chrome reports the model is available. Manual cloud checks
   require step 4.

`npm run dev` rebuilds on change; reload the extension to pick it up.

Do not publish or broadly distribute `dist/`: this is a private debug build. Never add a literal
debug token to `.env.local`, the source, or a release archive. The build checks that the old
local debug token is absent from `dist/`. If a prior bundle containing that token was shared,
revoke it in Firebase App Check.

## Release status

`npm run build:release` is deliberately blocked until a production App Check attestation path
is implemented for Chrome extensions. Manifest V3 extension pages cannot load reCAPTCHA's remote
script, and Firebase AI Logic now requires App Check. The public source is suitable for review;
the private judge build needs the owner to register each install's token before cloud features
work. Judges do not need to create a Firebase project. On November 17, 2026, a local Chromium
run returned real Firebase AI Logic cloud verdicts for all [eight synthetic fixtures](evaluation/README.md):
four suspicious pages were flagged and four legitimate pages were marked safe in one pass.
The [raw results](evaluation/results.csv) and [run notes](evaluation/run-notes.md) show the source labels
and limits. The on-device Prompt API was unavailable in that extension test environment. A separate
second-opinion check first hit the project's search-grounding quota, then returned an ungrounded
cloud opinion. The current panel makes that limit explicit: web verification was unavailable and
the explanation used only the page shown. A separate screenshot check of a synthetic
parcel-page image returned a suspicious, cloud-labelled verdict ([observation](evaluation/screenshot-observation.json)).
Grounded source links remain unverified. The extension's automatic check later returned a suspicious, on-device-labelled result against a synthetic local parcel page in native Chrome's side panel; [the capture](demo/extension-check-on-device.webm) records it. The hosted web demo independently returned live cloud results for a suspicious parcel message and an ordinary delivery update, plus the Chrome 157 on-device results described above.

## Local archived-page pilot

We also tested the `ONLY_ON_DEVICE` screener against [40 archived real sites](evaluation/real-world/README.md) from ScamFerret's 2024 evaluation corpus: five scam and five legitimate pages in each of four English categories. The HTML was parsed into inert, text-only page snapshots; no scam site was opened. The [local runner](evaluation/local-runner.md) records the model's reported inference source and does not use the requested-check cloud fallback. Its [40-case results](evaluation/real-world/results-40.json) were:

| Publisher label | Suspicious | Unsure | Safe | Error |
| --- | ---: | ---: | ---: | ---: |
| Scam (20) | 14 | 3 | 1 | 2 |
| Legitimate (20) | 2 | 7 | 11 | 0 |

This includes one scam marked safe and two legitimate pages flagged. Thirty-eight cases reported `on-device`, two errors had unknown source, and none reported cloud inference. The initial [eight-case smoke run](evaluation/real-world/results-8.json) had two suspicious, one unsure, and one error among scams; one suspicious and three safe among legitimate pages. Three of those eight cases changed outcome when included in the 40-case run. These are observed results from a small convenience sample, not a real-world accuracy estimate. The 40 URLs represent 38 unique extracted content patterns, and static text snapshots cannot reproduce every rendered or dynamic signal.

A follow-up [200-site review and independent 80-site evaluation](evaluation/real-world/README.md) exposed unsafe green verdicts on shopping pages and intermittent on-device timeouts. The extension now changes a safe verdict to unsure when a page asks for sensitive details or has a redirecting form or link. On the fresh 80-site set, the final local run marked 30 scams suspicious, nine unsure, none safe, and timed out on one; among 40 legitimate sites, one was marked suspicious. The result is a bounded archived-page test, not a live-browsing accuracy estimate.

The [80-second narrated demo](https://scam-shield-landing-phi.vercel.app/#demo-video) has ElevenLabs
voiceover, captions, and [native Chrome side-panel footage](demo/extension-check-on-device.webm)
of an on-device check against a synthetic parcel page. The page and portrait are illustrative;
a still of the page is shown beside the recorded side panel. The [capture notes](demo/storyboard.md)
explain what each shot proves. The [current YouTube upload](https://youtu.be/49NiHLv1WZg) is the
earlier silent cut.

## Not built yet

- Family circle: alert a trusted relative through Auth and Firestore.
- Always-on screening with the panel closed (needs an offscreen document).
- A production App Check provider for Chrome extensions.
- Android share target.

## License

Apache-2.0
