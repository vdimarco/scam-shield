"""Build inert Scam Shield page snapshots from the ScamFerret evaluation corpus."""

import gzip
import hashlib
import json
import os
import re
import sys
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
from urllib.parse import quote, urljoin, urlsplit
from urllib.request import Request, urlopen


COMMIT = "8cf8dc631edafe584141e2f95f0c0f51855fb7bc"
CATEGORIES = ("online_shopping_english", "technical_support", "cryptocurrency", "investment")
BASE = "https://raw.githubusercontent.com/ScamFerret/artifact/" + COMMIT + "/dataset"
HERE = Path(__file__).resolve().parent
PRIVATE = Path.home() / ".local/share/scam-shield/evaluation"
MAX_ARCHIVE_BYTES = 1_000_000
MAX_HTML_BYTES = 16_000_000
MAX_TEXT_CHARS = 12_000
MAX_TITLE_CHARS = 500
SKIP_TAGS = {"script", "style", "template", "noscript", "svg"}
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
BLOCK_TAGS = {"p", "div", "br", "li", "section", "article", "header", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "tr"}
SHOWN_HOST = re.compile(r"^(?:https?://)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)", re.I)


def fetch(url: str) -> bytes:
    with urlopen(Request(url, headers={"User-Agent": "ScamShield-evaluation"}), timeout=60) as response:
        return response.read()


def host(url: str) -> str:
    return (urlsplit(url).hostname or "").lower()


def utf16_prefix(value: str, limit: int) -> tuple[str, bool]:
    units = 0
    for index, char in enumerate(value):
        units += 2 if ord(char) > 0xFFFF else 1
        if units > limit:
            return value[:index], True
    return value, False


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.body = False
        self.title_depth = 0
        self.hidden = 0
        self.elements = []
        self.title = []
        self.text = []
        self.inputs = []
        self.forms = []
        self.links = []
        self.current_link = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "body":
            self.body = True
        if tag == "title":
            self.title_depth += 1
        hide = tag in SKIP_TAGS or "hidden" in attrs or bool(re.search(r"display\s*:\s*none", attrs.get("style") or "", re.I))
        if tag not in VOID_TAGS:
            self.elements.append((tag, hide))
            self.hidden += hide
        if tag == "input":
            self.inputs.append(attrs)
        if tag == "form":
            self.forms.append(attrs.get("action") or "")
        if tag == "a" and "href" in attrs and len(self.links) < 400 and self.current_link is None:
            self.current_link = [attrs.get("href") or "", []]
        if self.body and not self.hidden and tag in BLOCK_TAGS:
            self.text.append("\n")

    def handle_endtag(self, tag):
        if tag == "title" and self.title_depth:
            self.title_depth -= 1
        if tag == "a" and self.current_link is not None:
            self.links.append((self.current_link[0], "".join(self.current_link[1]).strip()))
            self.current_link = None
        if self.body and not self.hidden and tag in BLOCK_TAGS:
            self.text.append("\n")
        for index in range(len(self.elements) - 1, -1, -1):
            if self.elements[index][0] == tag:
                self.hidden -= sum(hidden for _, hidden in self.elements[index:])
                del self.elements[index:]
                break
        if tag == "body":
            self.body = False

    def handle_data(self, data):
        if self.title_depth:
            self.title.append(data)
        if self.body and not self.hidden:
            self.text.append(data)
            if self.current_link is not None:
                self.current_link[1].append(data)


def snapshot_from_html(url: str, html: str) -> dict:
    parser = PageParser()
    parser.feed(html)
    page_host = host(url)
    text = re.sub(r"\s*\n\s*", "\n", "".join(parser.text)).strip()
    bounded_text, truncated = utf16_prefix(text, MAX_TEXT_CHARS)
    title, _ = utf16_prefix("".join(parser.title).strip(), MAX_TITLE_CHARS)
    forms_elsewhere = sum(bool(action and host(urljoin(url, action)) != page_host) for action in parser.forms)
    mismatched = 0
    for href, shown_text in parser.links[:400]:
        match = SHOWN_HOST.match(shown_text)
        if not match:
            continue
        shown = match.group(1).lower().removeprefix("www.")
        actual = host(urljoin(url, href)).removeprefix("www.")
        if actual != shown and not actual.endswith("." + shown):
            mismatched += 1
    return {
        "url": url,
        "title": title,
        "text": bounded_text,
        "truncated": truncated,
        "asksForPassword": any((field.get("type") or "").lower() == "password" for field in parser.inputs),
        "asksForCard": any(re.search(r"cc-|card|cvv|cvc", " ".join(field.get(key) or "" for key in ("name", "id", "autocomplete", "placeholder")), re.I) for field in parser.inputs),
        "formsPostElsewhere": forms_elsewhere,
        "mismatchedLinks": mismatched,
    }


def selected_files(label: str, category: str, start=0, count=5):
    folder = f"dataset/{'scam_websites' if label == 'scam' else 'legitimate_websites'}/{category}"
    api = f"https://api.github.com/repos/ScamFerret/artifact/contents/{folder}/toppage_html?ref={COMMIT}"
    files = json.loads(fetch(api))
    urls = fetch(f"{BASE}/{folder.removeprefix('dataset/')}/groundtruth_url.txt").decode("utf-8").splitlines()
    by_host = {}
    for url in urls:
        by_host.setdefault(host(url), url)
    eligible = []
    missing_url = oversized = 0
    for item in files:
        if not item["name"].endswith(".html.gz"):
            continue
        filename_host = item["name"][:-8].lower()
        original_url = by_host.get(filename_host) or by_host.get("www." + filename_host)
        if not original_url:
            missing_url += 1
            continue
        if item["size"] > MAX_ARCHIVE_BYTES:
            oversized += 1
            continue
        eligible.append((item, original_url))
    eligible.sort(key=lambda pair: hashlib.sha256(f"{label}/{category}/{pair[0]['sha']}".encode()).hexdigest())
    if count is not None and len(eligible) < start + count:
        raise RuntimeError(f"Only {len(eligible)} eligible pages for {label}/{category}")
    return folder, eligible[start:] if count is None else eligible[start:start + count], {"label": label, "category": category, "published": len(files), "eligible": len(eligible), "missing_url": missing_url, "oversized": oversized}


def load_case(folder, item, original_url, case_id, label, category):
    archive = fetch(f"{BASE}/{folder.removeprefix('dataset/')}/toppage_html/{quote(item['name'])}")
    blob_sha = hashlib.sha1(f"blob {len(archive)}\0".encode() + archive).hexdigest()
    if blob_sha != item["sha"]:
        raise RuntimeError(f"Git blob hash mismatch for {case_id}")
    with gzip.GzipFile(fileobj=BytesIO(archive)) as zipped:
        html = zipped.read(MAX_HTML_BYTES + 1)
    if len(html) > MAX_HTML_BYTES:
        raise RuntimeError(f"HTML exceeds 16 MB for {case_id}")
    page = snapshot_from_html(original_url, html.decode("utf-8", errors="replace"))
    return {"id": case_id, "label": label, "category": category, "expectedRisk": "suspicious" if label == "scam" else "safe", "page": page}


def content_pattern(page):
    return json.dumps({key: value for key, value in page.items() if key != "url"}, sort_keys=True)


def has_content(page):
    return bool(page["title"].strip() or page["text"].strip())


def write_snapshots(name: str, cases: list[dict]):
    PRIVATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    PRIVATE.chmod(0o700)
    output = PRIVATE / name
    pending = output.with_suffix(".tmp")
    fd = os.open(pending, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, "w") as file:
        json.dump({"cases": cases}, file, ensure_ascii=False)
        file.write("\n")
    pending.replace(output)
    print(f"Wrote {len(cases)} inert snapshots to {output} ({sum(case['label'] == 'scam' for case in cases)} scam, {sum(case['label'] == 'benign' for case in cases)} benign)")


def main(holdout=False):
    start, count = (5, 25) if holdout else (0, 5)
    manifest = {"source": "ScamFerret/artifact dataset (evaluation split)", "commit": COMMIT, "selection": ("First 25 distinct extracted title/text/feature patterns in SHA-256 hash order after the five pilot pages per English category and class; exclude captures with empty extracted title and text, all pilot IDs, URLs, and content patterns, plus previously selected holdout URLs and patterns; mapped original URL and compressed file <=1 MB" if holdout else "Five lowest SHA-256 hashes of label/category/Git-blob-SHA per English category and class, with mapped original URL and compressed file <=1 MB"), "eligibility": [], "cases": []}
    if not holdout:
        manifest["smoke_ids"] = []
    else:
        pilot_path = PRIVATE / "pilot.json"
        if not pilot_path.exists():
            raise RuntimeError("Generate pilot.json first to verify URL disjointness")
        pilot_cases = json.loads(pilot_path.read_text())["cases"]
        pilot_ids = {case["id"] for case in pilot_cases}
        pilot_urls = {case["page"]["url"] for case in pilot_cases}
        if len(pilot_ids) != 40 or len(pilot_urls) != 40:
            raise RuntimeError("Expected 40 distinct pilot IDs and original URLs")
        pilot_manifest = json.loads((HERE / "manifest.json").read_text())
        if pilot_manifest["commit"] != COMMIT or {case["id"] for case in pilot_manifest["cases"]} != pilot_ids:
            raise RuntimeError("Private pilot does not match the tracked manifest")
        seen_patterns = {content_pattern(case["page"]) for case in pilot_cases}
        seen_urls = set(pilot_urls)
        manifest["selection_exclusions"] = []
    selected = []
    cases = []
    for category in CATEGORIES:
        for label in ("scam", "benign"):
            folder, files, counts = selected_files(label, category, start, None if holdout else count)
            manifest["eligibility"].append(counts)
            skipped_patterns = skipped_urls = skipped_empty = 0
            group_count = 0
            for rank, (item, original_url) in enumerate(files, start + 1):
                if holdout and group_count == count:
                    break
                case_id = f"{label}/{category}/{item['sha']}"
                if holdout:
                    if case_id in pilot_ids or original_url in seen_urls:
                        skipped_urls += 1
                        continue
                    case = load_case(folder, item, original_url, case_id, label, category)
                    if not has_content(case["page"]):
                        skipped_empty += 1
                        continue
                    pattern = content_pattern(case["page"])
                    if pattern in seen_patterns:
                        skipped_patterns += 1
                        continue
                    seen_patterns.add(pattern)
                    seen_urls.add(original_url)
                    cases.append(case)
                    group_count += 1
                    manifest["cases"].append({"id": case_id, "label": label, "category": category, "blob_sha": item["sha"], "hash_rank": rank})
                    continue
                if not holdout and item == files[0][0]:
                    manifest["smoke_ids"].append(case_id)
                manifest["cases"].append({"id": case_id, "label": label, "category": category, "blob_sha": item["sha"]})
                selected.append((folder, item, original_url, case_id, label, category))
            if holdout:
                if group_count != count:
                    raise RuntimeError(f"Only {group_count} unique patterns for {label}/{category}")
                manifest["selection_exclusions"].append({"label": label, "category": category, "duplicate_patterns": skipped_patterns, "duplicate_urls_or_ids": skipped_urls, "empty_captures": skipped_empty})
    manifest_path = HERE / ("manifest-200.json" if holdout else "manifest.json")
    if manifest_path.exists() and not holdout:
        if json.loads(manifest_path.read_text()) != manifest:
            raise RuntimeError("Publisher selection differs from tracked manifest; do not silently change the pilot")
    for folder, item, original_url, case_id, label, category in selected:
        cases.append(load_case(folder, item, original_url, case_id, label, category))
    if holdout:
        ids = {case["id"] for case in cases}
        urls = [case["page"]["url"] for case in cases]
        if len(ids) != 200 or ids & pilot_ids or len(set(urls)) != 200 or set(urls) & pilot_urls:
            raise RuntimeError("Holdout IDs or original URLs are not distinct from the pilot")
        if any(not has_content(case["page"]) for case in cases):
            raise RuntimeError("Holdout has an empty title and text capture")
        manifest["unique_original_urls"] = len(set(urls))
        manifest["unique_content_patterns"] = len({content_pattern(case["page"]) for case in cases})
        if manifest["unique_content_patterns"] != 200:
            raise RuntimeError("Holdout has duplicate extracted content patterns")
        if manifest_path.exists() and json.loads(manifest_path.read_text()) != manifest:
            raise RuntimeError("Publisher selection differs from tracked holdout manifest")
    outputs = (("holdout-200.json", cases),) if holdout else (("pilot.json", cases), ("pilot-8.json", [case for case in cases if case["id"] in manifest["smoke_ids"]]))
    for name, subset in outputs:
        write_snapshots(name, subset)
    if not manifest_path.exists():
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    if sys.argv[1:] not in ([], ["--holdout-200"]):
        raise SystemExit("Usage: python3 evaluation/real-world/ingest.py [--holdout-200]")
    main(sys.argv[1:] == ["--holdout-200"])
