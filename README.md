# Scam Shield

A Chrome extension that screens the active page for scams while its side panel is open.
Automatic screening runs on the computer; cloud checks require a button tap.

Built for #BuildHybridAI 2026 with the Firebase AI Logic hybrid inference SDK.

## Why hybrid

Routine page screening should not send browsing content to a server. Scam Shield uses the
on-device model for automatic checks while its panel is open. A small local model cannot look
anything up, so the design offers an optional cloud second opinion for flagged pages.

| Step | Inference mode | Why |
| --- | --- | --- |
| Automatic screening while the panel is open | `ONLY_ON_DEVICE` (Gemini Nano) | These checks keep page content on the computer |
| "Check this page" and screenshot checks | `PREFER_ON_DEVICE` | Can fall back to cloud after App Check is set up; the panel indicates which mode ran |
| "Get a second opinion" | `ONLY_IN_CLOUD` + Google Search grounding | Looks up the sender and domain; grounded-result validation is pending |

If a computer has no local model, automatic screening stays off rather than falling back to
the cloud. The footer counts pages checked locally and pages sent to the cloud while the panel
is open.

Other Firebase products: App Check (required, per-install debug provider for private judging) and Remote Config
(`cloud_model`, `auto_screen`, `max_page_chars`).

The routing lives in [src/models.ts](src/models.ts).

## Run the private judge build

The public source includes the demo project's Firebase web config in `.env.example`. Firebase
web config identifies the app; it is not an App Check credential. The debug build generates a
different App Check token on each install, so there is no shared token in source or `dist/`.

1. `cp .env.example .env.local`, then `npm install` and `npm run build`.
   This is the same as `npm run build:judge`.
2. In Chrome 139+, enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` and restart.
3. Open `chrome://extensions`, turn on Developer mode, **Load unpacked**, pick `dist/`.
4. Click the extension icon to open the side panel. Right-click the panel, select **Inspect**,
   and privately send the generated `App Check debug token` shown in the console to the project
   owner. The owner registers it in the demo Firebase project under **Security > App Check >
   Apps > Manage debug tokens**. Reload the extension after the owner confirms registration.
5. Click **Turn on private screening** (downloads the local model once), then try the labelled
   synthetic examples linked from the landing page. Manual cloud checks require step 4.

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
smoke test returned a real Firebase AI Logic cloud verdict after its private token was registered.
The on-device Prompt API was unavailable in that test environment; grounded second opinions and
screenshot checks remain unverified.

## Not built yet

- Family circle: alert a trusted relative through Auth and Firestore.
- Always-on screening with the panel closed (needs an offscreen document).
- A production App Check provider for Chrome extensions.
- Android share target.
- An accuracy test set of real phishing and legitimate pages.

## License

Apache-2.0
