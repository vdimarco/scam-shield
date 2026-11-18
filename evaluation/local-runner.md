# Local snapshot runner

The runner evaluates saved `PageSnapshot` JSON with the extension's existing `ONLY_ON_DEVICE` screener. It never opens or fetches case URLs. Use only inert, labelled samples; do not commit the input JSON or raw page content.

1. In Chrome Desktop, enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` and restart. The browser needs enough free disk space to download its local model.
2. From the repo root, run `npx vite --mode development --host 127.0.0.1 --port 5178`.
3. Open `http://127.0.0.1:5178/evaluation/local-runner.html` in that Chrome profile.
4. Choose a private snapshot JSON, click **Prepare local model**, then **Run checks**.
5. Download the results JSON. It contains IDs, labels, verdicts, inference sources, elapsed times, and error categories, without page text, URLs, or model explanations. Future failures also include a bounded error name and code; error messages are never exported.

A verdict counts as a local success only when Firebase AI Logic reports `on_device`. A cloud or unknown source is recorded as an error. If model setup fails, the runner exports one `local-model-unavailable` error per case. The results are a small sample check, not an accuracy estimate for real browsing.

Check the runner logic with `node --test evaluation/local-runner.test.mjs` and `npm run typecheck`.

For a larger run, use the bounded harness. It opens a new tab for each case, closes the tab after a 60-second deadline, and saves a metadata-only checkpoint after each result. Restart the same command to resume; the input SHA-256, deadline, and Chrome version must match. Keep Vite bound to loopback and use the Chrome profile with the local model already downloaded and CDP listening on port 9234.

```bash
npx vite --mode development --host 127.0.0.1 --port 5178
```

In another terminal:

```bash
node evaluation/run-bounded-local.mjs \
  "$HOME/.local/share/scam-shield/evaluation/holdout-200.json" \
  evaluation/real-world/results-200.json 60000
```

The report stores case IDs, labels, categories, verdicts, inference sources, elapsed times, error categories, the input SHA-256, deadline, Chrome version, and run time. It also records the last fixed stage name and elapsed session-creation and prompt times when Chrome exposes those boundaries. A timeout at `session-create` points to model-session preparation; a timeout at `prompt-start` points to the prompt operation, which includes inference. Earlier timeouts have no such trace. The model-availability preflight runs before case tracing and stops with a setup error after 15 seconds if Chrome does not answer. The report contains no page text, URLs, or model explanations. The harness blocks non-loopback requests from its case tabs and treats any nonlocal inference source as an error. Test deadline and tab closure with `node --test evaluation/run-bounded-local.test.mjs`.
