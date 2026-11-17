# Scam Shield landing and live judge demo

The page tells the grandmother story and includes a separate live check of pasted text. The parcel example above it is explicitly illustrative. The live check calls Firebase AI Logic in `PREFER_ON_DEVICE` mode and displays the SDK-reported inference source. In Chrome Desktop with the Prompt API available it can run locally; otherwise the request can use Gemini in the cloud.

## Run

1. `cp .env.example .env.local`
2. Fill `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` after completing the setup below.
3. `npm ci && npm run build && npm test`
4. Serve `dist` over HTTPS. Local Vite development can use `npm run dev`.

All `VITE_` values are public browser configuration. Never put a Firebase App Check debug token or server credential in this repo or Vercel environment variables.

## Required Firebase and Google Cloud setup

1. In project `talos-c1eba`, enable reCAPTCHA Enterprise if needed and create a **score-based Web key** for the exact HTTPS demo hostname. Include any later custom hostname as an allowed domain. Do not add `localhost` to a production key.
2. In Firebase Console → App Check, register the existing `talos` Web app with **reCAPTCHA Enterprise** and the same site key. Keep Firebase AI Logic App Check enforcement enabled.
3. Put that public site key in `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` for the Vercel Production environment, and the public Firebase values in `.env.example` in the corresponding `VITE_` variables. Configure Vercel to build this repository with `npm run build` and serve `dist`, then deploy. If uploading a prebuilt `dist` folder instead, set the variables locally **before** `npm run build`; Vite embeds them during the build.
4. Verify both synthetic examples through the deployed HTTPS page. Record the actual verdict, inference source, and any network or App Check failure. A successful build alone does not prove inference works.

If the site key is absent, the live check is disabled and says setup is pending. No sample verdict is substituted for an AI result. The pasted text may be sent to Firebase AI Logic cloud when the device model is unavailable; the interface discloses this before the user clicks.
