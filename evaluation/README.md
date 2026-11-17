# Synthetic evaluation

Eight local pages exercise the scam patterns and false alarms relevant to Scam Shield. Four have concrete scam signals; four are ordinary pages. Their labels and reasons are in [`cases.json`](cases.json). Every company, message, and person is fictional. `.invalid` links cannot resolve, payment fields are disabled, and buttons do not submit. Do not enter personal information.

This is a **small product check**, not a claim about real-world detection accuracy. Localhost URLs remove domain reputation and sender identity from the test. The fixture banner also tells the model that each page is synthetic. Report these limits with any counts.

**Observed November 17, 2026, on the final risk-and-reason UI build:** one requested check per fixture in Chromium produced 4/4 suspicious warnings and 4/4 safe verdicts on legitimate pages, with no unsure results or errors. All eight were labelled as cloud checks because the local model was unavailable. See the [raw results](results.csv), [visible observations](observations.json), and [run notes](run-notes.md). These counts do not measure the on-device path or real-world accuracy.

A separate tap on **Get a second opinion** for the parcel page initially returned a visible error and no source links; a repeat trace identified an HTTP 429 quota response for the search-grounded cloud model. A later build retried without web search after that quota response. In an actual Chromium run it returned a plain-language answer, explicitly said it could not independently verify the page, and displayed **“No supporting web sources were returned.”** The request trace was 200 for the first page check, 429 for the grounded attempt, and 200 for the ungrounded fallback. See the [second-opinion history](second-opinion-observation.json) and [fallback panel capture](../demo/frames/04-second-opinion-fallback.png). Grounded second opinion has not been demonstrated.

## Run the real extension

1. Build and load the extension using the root README, with a test Firebase project and no personal browsing data. Keep the Scam Shield side panel open.
2. In the project root, run `python3 -m http.server 8765 --bind 127.0.0.1 --directory evaluation/fixtures`.
3. Open each `http://127.0.0.1:8765/<file>` from `cases.json`. For a requested run, click **Check this page**. For an automatic run, first click **Turn on private screening**, then navigate to a fixture with a fresh `?run=1` query so the page is checked anew. Repeat with `?run=2` and `?run=3` if time permits.
4. Record the observed risk and source in [`results.csv`](results.csv), one row per attempt. Read the side panel, including errors. Use `safe`, `unsure`, `suspicious`, or `error`; use `on-device`, `cloud`, or `unknown` for the source. Use `unknown` whenever the panel cannot establish the inference source, including a completed verdict. Example row format: `parcel-fee,1,requested,suspicious,on-device` (format only; **not an observed result**).
5. Run `node evaluation/score.mjs`. The scorer rejects unknown labels, duplicate runs, and cloud results marked automatic. Keep the raw CSV with any reported totals.

The scorer reports counts for suspicious catches, suspicious pages shown safe, legitimate false alarms, unsure verdicts, and errors. It separates automatic/on-device from requested/on-device and requested/cloud, because these are different inference paths. A `safe` verdict on a suspicious fixture is the most important failure to investigate. An `unsure` verdict is reported separately rather than silently counted as a catch.

Record the Chrome version, extension commit or build date, model availability, Firebase test-project configuration, date, and any disabled cases in [`run-notes.md`](run-notes.md). Do not put API keys, App Check debug tokens, personal messages, or real browsing URLs in that file. If the local model is unavailable, skip automatic runs and record why; never label requested cloud checks as local.
