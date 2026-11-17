# Real scam-page pilot

This pilot uses the **evaluation** corpus in [ScamFerret's research artifact](https://github.com/ScamFerret/artifact), pinned to commit `8cf8dc631edafe584141e2f95f0c0f51855fb7bc`. It has five scam and five legitimate archived English pages in each of four categories: online shopping, technical support, cryptocurrency, and investment (40 total). The tracked [manifest](manifest.json) contains only Git blob hashes and labels. Selection is deterministic: the five lowest hashes of `label/category/Git-blob-SHA` among pages with a matching original URL and a compressed archive no larger than 1 MB. Eligibility and exclusions are recorded in the manifest.

Run `python3 evaluation/real-world/ingest.py` from the project root. It fetches **only** the publisher's pinned GitHub artifact, decompresses selected HTML as inert data, and writes `pilot-8.json` and `pilot.json` to `~/.local/share/scam-shield/evaluation/`. That private directory is outside the repository and Vite's served files, with directory mode `0700` and snapshot files `0600`, because the snapshots contain original URLs and potentially sensitive page text. The importer never visits a scam URL, loads remote page resources, runs JavaScript, or serves the archived HTML. It verifies each archive against its Git blob hash and caps decompression at 16 MB. Run the extraction check with `python3 -m unittest discover -s evaluation/real-world`.

For a separate 200-site holdout, run `python3 evaluation/real-world/ingest.py --holdout-200` after generating `pilot.json`. It starts at hash rank **6** in each label/category group and takes the first 25 distinct extracted title/text/feature patterns not present in the pilot or earlier holdout selections (25 scam and 25 legitimate per category). Captures with both empty extracted title and text are excluded. This content-quality rule was set before the full 200-case run and does not use model verdicts; two smoke verdicts from the initial holdout had already been observed. The importer verifies 200 distinct case IDs, original URLs, and content patterns, all disjoint from the 40-site pilot. It writes private `holdout-200.json` beside the pilot snapshots and tracked [manifest-200.json](manifest-200.json) with labels, blob hashes, selected hash ranks, eligibility, and exclusion counts. Original URLs and page text remain outside the repository. The technical-support scam group reaches rank 69 and the cryptocurrency scam group rank 84 because those groups contain repeated templates; one empty cryptocurrency capture is also skipped. All other groups end at rank 30.

The generated cases match Scam Shield's `PageSnapshot` fields, with page text capped at the app's default 12,000 JavaScript UTF-16 code units and titles capped at the runner's 500-unit limit. The static parser approximates visible browser text and form/link signals; it cannot apply every CSS rule or reconstruct dynamic content. The eight-case smoke set has one scam and one benign page per category. The 40 cases cover distinct site URLs but only 38 unique extracted content patterns: two scam-template pairs differ only by URL, so site-level counts include correlated examples. Both sets have now been run and inspected; the remaining 32 cases are no longer an untouched holdout for future tuning. These selected pages are a convenience sample, so neither result is a population accuracy estimate. Keep the prior synthetic evaluation separate.

## Observed local results (November 17, 2026)

The [local-only runner](../local-runner.md) used `ONLY_ON_DEVICE` inference on the inert snapshots in Chrome 157.0.8103.78 on Linux, with its local model already downloaded. The [40-case run](results-40.json) produced:

| Publisher label | Suspicious | Unsure | Safe | Error |
| --- | ---: | ---: | ---: | ---: |
| Scam (20) | 14 | 3 | 1 | 2 |
| Legitimate (20) | 2 | 7 | 11 | 0 |

| Category | Publisher label | Suspicious | Unsure | Safe | Error |
| --- | --- | ---: | ---: | ---: | ---: |
| Online shopping | Scam | 1 | 3 | 1 | 0 |
| Online shopping | Legitimate | 0 | 2 | 3 | 0 |
| Technical support | Scam | 4 | 0 | 0 | 1 |
| Technical support | Legitimate | 0 | 2 | 3 | 0 |
| Cryptocurrency | Scam | 4 | 0 | 0 | 1 |
| Cryptocurrency | Legitimate | 2 | 3 | 0 | 0 |
| Investment | Scam | 5 | 0 | 0 | 0 |
| Investment | Legitimate | 0 | 0 | 5 | 0 |

This includes one scam marked safe and two legitimate sites flagged. Thirty-eight cases reported `on-device`, none reported cloud, and the two errors had unknown inference source. The harness blocked an external `content-firebaseappcheck.googleapis.com` request; no cloud inference occurred. The two errors were scam pages in technical support and cryptocurrency (`inference-failed` after 241,038 ms and 209,620 ms, respectively). Total case elapsed time was 536,411 ms. These error categories do not establish a root cause.

The earlier [eight-case smoke run](results-8.json) produced two suspicious, one unsure, and one error among scam pages, and one suspicious plus three safe among legitimate pages. Three of those same cases changed when run again in the 40-case set: the shopping scam changed from unsure to suspicious, the legitimate cryptocurrency page from suspicious to unsure, and the investment scam from error to suspicious. That investment case had 12,000 extracted text characters, yet succeeded on the repeat, so text length alone does not explain the errors.

To reproduce, run the importer above, then follow [the runner steps](../local-runner.md): start `npx vite --mode development --host 127.0.0.1 --port 5178`, open `http://127.0.0.1:5178/evaluation/local-runner.html` in a Chrome profile with the on-device model enabled, choose `pilot-8.json`, `pilot.json`, or `holdout-200.json` from the private directory, prepare the local model, run checks, and download results. Compare case IDs and labels against the manifest; report errors and unsure verdicts alongside catches and false alarms.

ScamFerret's repository is GPL-3.0 and does not state a separate data license. No publisher HTML, screenshots, URLs, or generated snapshots are committed or redistributed here. Cite the [ScamFerret paper](https://doi.org/10.1007/978-3-031-97620-9_1) when reporting results.
