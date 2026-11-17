# Local snapshot runner

The runner evaluates saved `PageSnapshot` JSON with the extension's existing `ONLY_ON_DEVICE` screener. It never opens or fetches case URLs. Use only inert, labelled samples; do not commit the input JSON or raw page content.

1. In Chrome Desktop, enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` and restart. The browser needs enough free disk space to download its local model.
2. From the repo root, run `npx vite --mode development --host 127.0.0.1 --port 5178`.
3. Open `http://127.0.0.1:5178/evaluation/local-runner.html` in that Chrome profile.
4. Choose `evaluation/real-world/pilot-8.json`, click **Prepare local model**, then **Run checks**. After reviewing the 4 scam and 4 benign results, run the larger `pilot.json`.
5. Download the results JSON. It contains IDs, labels, verdicts, inference sources, elapsed times, and error categories, without page text, URLs, or model explanations. Future failures also include a bounded error name and code; error messages are never exported.

A verdict counts as a local success only when Firebase AI Logic reports `on_device`. A cloud or unknown source is recorded as an error. If model setup fails, the runner exports one `local-model-unavailable` error per case. The results are a small sample check, not an accuracy estimate for real browsing.

Check the runner logic with `node --test evaluation/local-runner.test.mjs` and `npm run typecheck`.
