"""Seal a new, pattern-distinct ScamFerret set before changing the detector."""

import hashlib
import json
from collections import Counter

from ingest import (
    CATEGORIES,
    COMMIT,
    HERE,
    PRIVATE,
    content_pattern,
    has_content,
    load_case,
    selected_files,
    write_snapshots,
)


PER_GROUP = 10
OUTPUT = "fresh-holdout-80.json"


def main():
    prior = []
    max_rank = {}
    for manifest_name, snapshot_name, expected in (
        ("manifest.json", "pilot.json", 40),
        ("manifest-200.json", "holdout-200.json", 200),
    ):
        manifest = json.loads((HERE / manifest_name).read_text())
        cases = json.loads((PRIVATE / snapshot_name).read_text())["cases"]
        if manifest["commit"] != COMMIT or len(cases) != expected or {case["id"] for case in cases} != {case["id"] for case in manifest["cases"]}:
            raise RuntimeError(f"Private {snapshot_name} does not match the pinned manifest")
        prior.extend(cases)
        for case in manifest["cases"]:
            key = (case["label"], case["category"])
            max_rank[key] = max(max_rank.get(key, 0), case.get("hash_rank", 5))

    seen_ids = {case["id"] for case in prior}
    seen_urls = {case["page"]["url"] for case in prior}
    seen_patterns = {content_pattern(case["page"]) for case in prior}
    if len(seen_ids) != 240 or len(seen_urls) != 240:
        raise RuntimeError("The prior 240 sites must have distinct IDs and URLs")

    selected = []
    groups = []
    for category in CATEGORIES:
        for label in ("scam", "benign"):
            start = max_rank[(label, category)]
            folder, files, eligibility = selected_files(label, category, start, None)
            exclusions = Counter()
            chosen_ranks = []
            for rank, (item, original_url) in enumerate(files, start + 1):
                if len(chosen_ranks) == PER_GROUP:
                    break
                case_id = f"{label}/{category}/{item['sha']}"
                if case_id in seen_ids or original_url in seen_urls:
                    exclusions["duplicate_ids_or_urls"] += 1
                    continue
                case = load_case(folder, item, original_url, case_id, label, category)
                if not has_content(case["page"]):
                    exclusions["empty_captures"] += 1
                    continue
                pattern = content_pattern(case["page"])
                if pattern in seen_patterns:
                    exclusions["duplicate_patterns"] += 1
                    continue
                seen_ids.add(case_id)
                seen_urls.add(original_url)
                seen_patterns.add(pattern)
                selected.append(case)
                chosen_ranks.append(rank)
            if len(chosen_ranks) != PER_GROUP:
                raise RuntimeError(f"Only {len(chosen_ranks)} new content patterns for {label}/{category}")
            groups.append({**eligibility, "start_after_rank": start, "selected": PER_GROUP, "last_selected_rank": chosen_ranks[-1], **{key: exclusions[key] for key in ("duplicate_ids_or_urls", "duplicate_patterns", "empty_captures")}})

    ids = {case["id"] for case in selected}
    urls = {case["page"]["url"] for case in selected}
    patterns = {content_pattern(case["page"]) for case in selected}
    if len(selected) != 80 or len(ids) != 80 or len(urls) != 80 or len(patterns) != 80:
        raise RuntimeError("Fresh holdout must have 80 distinct IDs, URLs, and content patterns")
    if ids & {case["id"] for case in prior} or urls & {case["page"]["url"] for case in prior} or patterns & {content_pattern(case["page"]) for case in prior}:
        raise RuntimeError("Fresh holdout overlaps an earlier evaluation set")

    snapshot_bytes = (json.dumps({"cases": selected}, ensure_ascii=False) + "\n").encode()
    manifest = {
        "source": "ScamFerret/artifact dataset (evaluation split)",
        "commit": COMMIT,
        "selection": "For each English category and class, resume SHA-256(label/category/Git-blob-SHA) order after the highest rank reached by the pilot or 200-site set; choose the first 10 with mapped original URL, compressed archive <=1 MB, nonempty extracted title or text, and IDs, URLs, and extracted title/text/feature patterns distinct from both earlier sets and all earlier fresh selections. Selection uses no model verdicts.",
        "groups": groups,
        "cases": len(selected),
        "unique_original_urls": len(urls),
        "unique_content_patterns": len(patterns),
        "snapshot_sha256": hashlib.sha256(snapshot_bytes).hexdigest(),
    }
    path = HERE / "manifest-fresh-80.json"
    if path.exists() and json.loads(path.read_text()) != manifest:
        raise RuntimeError("Fresh selection differs from the sealed manifest")
    write_snapshots(OUTPUT, selected)
    if hashlib.sha256((PRIVATE / OUTPUT).read_bytes()).hexdigest() != manifest["snapshot_sha256"]:
        raise RuntimeError("Private snapshot differs from its sealed digest")
    if not path.exists():
        path.write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
