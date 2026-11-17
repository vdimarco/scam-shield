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

## Observed 200-site holdout results (November 17, 2026)

The separate [200-case run](results-200.json) used 100 scam and 100 legitimate sites with distinct extracted content patterns, all disjoint from the prior 40 sites. Scam Shield's model and prompts were unchanged during this run. Chrome 157.0.8103.78 on Linux used `ONLY_ON_DEVICE` inference with a 60-second deadline per case; the input SHA-256 was `141e82c79e8739a63be00594de9643b98b757e993c00e6741a7e8f2f300cf328`.

| Publisher label | Suspicious | Unsure | Safe | Error |
| --- | ---: | ---: | ---: | ---: |
| Scam (100) | 66 | 26 | 6 | 2 |
| Legitimate (100) | 5 | 42 | 53 | 0 |

| Category | Publisher label | Suspicious | Unsure | Safe | Error |
| --- | --- | ---: | ---: | ---: | ---: |
| Online shopping | Scam | 5 | 14 | 6 | 0 |
| Online shopping | Legitimate | 0 | 10 | 15 | 0 |
| Technical support | Scam | 21 | 4 | 0 | 0 |
| Technical support | Legitimate | 0 | 10 | 15 | 0 |
| Cryptocurrency | Scam | 17 | 6 | 0 | 2 |
| Cryptocurrency | Legitimate | 5 | 18 | 2 | 0 |
| Investment | Scam | 23 | 2 | 0 | 0 |
| Investment | Legitimate | 0 | 4 | 21 | 0 |

Of the 200 checks, 198 reported `on-device`, none reported cloud, and two errors had unknown inference source. Cases 106 and 108, both cryptocurrency scams, ended with `deadline-exceeded` after 60,022 ms and `inference-failed` after 2,222 ms. Among on-device checks, median elapsed time was 2,341 ms and nearest-rank p95 was 3,961 ms. Six shopping scams were marked safe, while five legitimate cryptocurrency sites were flagged suspicious; these are the clearest weaknesses to investigate. An unsure verdict and an error are separate from a correct classification.

This is a template-diverse convenience sample of archived pages evaluated through static text and feature extraction, not a population accuracy estimate for live browsing. Two initial smoke verdicts were observed before the final content-quality rule and full run, though no model verdict was used to select or exclude a site. The dataset reflects pages archived by the publisher, and the extractor cannot reproduce dynamic content or all browser-visible styling.

## False-positive review and calibration (November 17, 2026)

The 200-site review found five legitimate cryptocurrency pages marked suspicious. Two isolated replays moved to unsure, and some other pages carried promotional or password-recovery language that could reasonably prompt caution from the extracted text. The six scam shopping pages marked safe mostly looked like ordinary storefronts in the snapshot; five asked for a password, while none showed a card field, external form, or mismatched link. A site-level publisher label does not reveal which warning signs were visible to the local model.

We tested a more detailed prompt on the same 200 development cases. It [worsened both costly outcomes](results-200-prompt-candidate.json): scam pages marked safe rose from 6 to 10, and legitimate pages flagged suspicious rose from 5 to 9. A shorter revision also made many shopping scams look safe in an early development check. We restored the original prompt instead of selecting a favorable wording from these unstable runs. No model weights were trained.

The final [page-verdict guard](../../src/verdict.ts) changes a model's **safe** result to **unsure** if the snapshot asks for a password or card, submits a form to another site, or displays a link whose stated address differs from its target. It preserves the existing partial-page guard. These signals do not prove fraud, so they never become a suspicious verdict by rule. Applying this guard to the *saved* 200-site baseline verdicts would move five scam shopping pages and five legitimate pages from safe to unsure. This is a deterministic counterfactual on saved results, not a second 200-site inference run; suspicious labels and the two recorded errors remain unchanged.

## Fresh 80-site evaluation (November 17, 2026)

The [fresh manifest](manifest-fresh-80.json) was sealed in commit `8ebd152` before calibration. It selects ten scam and ten legitimate archived pages per category, with 80 distinct URLs and extracted content patterns disjoint from the prior 240 sites. The inert private snapshots have SHA-256 `d95b5a926af3b52a8d5742e55d0962b60754e15b5b68e6a20ee0b1dece9a64d6`. The [baseline](results-fresh-80-baseline.json) was recorded in commit `7e94506` before prompt experiments or verdict changes; we did not inspect its verdicts until the final rule was chosen. All runs below used the same snapshots, Chrome 157.0.8103.78, `ONLY_ON_DEVICE`, a 60-second case deadline, and a runner that blocked non-loopback requests.

| Run | Scam suspicious | Scam unsure | Scam safe | Scam error | Legitimate suspicious | Legitimate unsure | Legitimate safe | Legitimate error | On-device | Cloud |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| [Pre-change baseline](results-fresh-80-baseline.json) | 33 | 5 | 2 | 0 | 1 | 18 | 21 | 0 | 80 | 0 |
| [Calibrated, retry pass 1](results-fresh-80-calibrated.json) | 29 | 7 | 0 | 4 | 2 | 19 | 19 | 0 | 76 | 0 |
| [Calibrated, retry pass 2](results-fresh-80-calibrated-repeat.json) | 28 | 8 | 0 | 4 | 3 | 18 | 19 | 0 | 76 | 0 |
| [Final, no retry](results-fresh-80-final.json) | 30 | 9 | 0 | 1 | 1 | 21 | 18 | 0 | 79 | 0 |

The final run used the same direct model call as final code commit `b922b02`; during that diagnostic run a temporary no-op retry helper was present, then removed. In the baseline, applying only the deterministic guard to the saved verdicts moves both scam-safe results and one legitimate-safe result to unsure. The other paired verdict changes in new runs reflect local-model variability, so they should not be credited to the guard. The final pass had one 60-second timeout on an investment scam, while the two retry passes each had four timeouts. The original 200-site run also timed out once before any retry was added. Four retry-pass timeout cases completed in eight isolated replays; the exact stall stage remains unknown. We removed the automatic retry because it showed no reliable benefit, and the side panel now stops waiting after 60 seconds and offers another check. The Firebase on-device call itself may continue after the UI deadline.

The final result has no scam page marked safe, but nine scam pages remain unsure and one received no verdict. One legitimate page was marked suspicious. These archived, statically extracted pages are a convenience sample, and the repeated verdict and timeout variation prevents a precise accuracy claim for live browsing.

To reproduce, run the importer above and `python3 evaluation/real-world/fresh_holdout.py`, then follow [the runner steps](../local-runner.md): start `npx vite --mode development --host 127.0.0.1 --port 5178`, open `http://127.0.0.1:5178/evaluation/local-runner.html` in a Chrome profile with the on-device model enabled, choose a private snapshot file, prepare the local model, run checks, and download results. Compare case IDs and labels against the manifest; report errors and unsure verdicts alongside catches and false alarms.

ScamFerret's repository is GPL-3.0 and does not state a separate data license. No publisher HTML, screenshots, URLs, or generated snapshots are committed or redistributed here. Cite the [ScamFerret paper](https://doi.org/10.1007/978-3-031-97620-9_1) when reporting results.
