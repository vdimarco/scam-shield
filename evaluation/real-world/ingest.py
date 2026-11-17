"""Build inert Scam Shield page snapshots from the ScamFerret evaluation corpus."""

import gzip
import hashlib
import json
import re
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
from urllib.parse import quote, urljoin, urlsplit
from urllib.request import Request, urlopen


COMMIT = "8cf8dc631edafe584141e2f95f0c0f51855fb7bc"
CATEGORIES = ("online_shopping_english", "technical_support", "cryptocurrency", "investment")
BASE = "https://raw.githubusercontent.com/ScamFerret/artifact/" + COMMIT + "/dataset"
HERE = Path(__file__).resolve().parent
MAX_ARCHIVE_BYTES = 1_000_000
MAX_HTML_BYTES = 16_000_000
MAX_TEXT_CHARS = 12_000
SKIP_TAGS = {"script", "style", "template", "noscript", "svg"}
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
BLOCK_TAGS = {"p", "div", "br", "li", "section", "article", "header", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "tr"}
SHOWN_HOST = re.compile(r"^(?:https?://)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)", re.I)


def fetch(url: str) -> bytes:
    with urlopen(Request(url, headers={"User-Agent": "ScamShield-evaluation"}), timeout=60) as response:
        return response.read()


def host(url: str) -> str:
    return (urlsplit(url).hostname or "").lower()


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
        "title": "".join(parser.title).strip(),
        "text": text[:MAX_TEXT_CHARS],
        "truncated": len(text) > MAX_TEXT_CHARS,
        "asksForPassword": any((field.get("type") or "").lower() == "password" for field in parser.inputs),
        "asksForCard": any(re.search(r"cc-|card|cvv|cvc", " ".join(field.get(key) or "" for key in ("name", "id", "autocomplete", "placeholder")), re.I) for field in parser.inputs),
        "formsPostElsewhere": forms_elsewhere,
        "mismatchedLinks": mismatched,
    }


def selected_files(label: str, category: str):
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
    if len(eligible) < 5:
        raise RuntimeError(f"Only {len(eligible)} eligible pages for {label}/{category}")
    return folder, eligible[:5], {"label": label, "category": category, "published": len(files), "eligible": len(eligible), "missing_url": missing_url, "oversized": oversized}


def main():
    manifest = {"source": "ScamFerret/artifact dataset (evaluation split)", "commit": COMMIT, "selection": "Five lowest SHA-256 hashes of label/category/Git-blob-SHA per English category and class, with mapped original URL and compressed file <=1 MB", "eligibility": [], "cases": [], "smoke_ids": []}
    selected = []
    for category in CATEGORIES:
        for label in ("scam", "benign"):
            folder, files, counts = selected_files(label, category)
            manifest["eligibility"].append(counts)
            for item, original_url in files:
                case_id = f"{label}/{category}/{item['sha']}"
                if item == files[0][0]:
                    manifest["smoke_ids"].append(case_id)
                manifest["cases"].append({"id": case_id, "label": label, "category": category, "blob_sha": item["sha"]})
                selected.append((folder, item, original_url, case_id, label, category))
    manifest_path = HERE / "manifest.json"
    if manifest_path.exists():
        if json.loads(manifest_path.read_text()) != manifest:
            raise RuntimeError("Publisher selection differs from tracked manifest; do not silently change the pilot")
    cases = []
    for folder, item, original_url, case_id, label, category in selected:
        archive = fetch(f"{BASE}/{folder.removeprefix('dataset/')}/toppage_html/{quote(item['name'])}")
        blob_sha = hashlib.sha1(f"blob {len(archive)}\0".encode() + archive).hexdigest()
        if blob_sha != item["sha"]:
            raise RuntimeError(f"Git blob hash mismatch for {case_id}")
        with gzip.GzipFile(fileobj=BytesIO(archive)) as zipped:
            html = zipped.read(MAX_HTML_BYTES + 1)
        if len(html) > MAX_HTML_BYTES:
            raise RuntimeError(f"HTML exceeds 16 MB for {case_id}")
        page = snapshot_from_html(original_url, html.decode("utf-8", errors="replace"))
        cases.append({"id": case_id, "label": label, "category": category, "expectedRisk": "suspicious" if label == "scam" else "safe", "page": page})
    for name, subset in (("pilot.json", cases), ("pilot-8.json", [case for case in cases if case["id"] in manifest["smoke_ids"]])):
        output = HERE / name
        pending = output.with_suffix(".tmp")
        pending.write_text(json.dumps({"cases": subset}, ensure_ascii=False) + "\n")
        pending.replace(output)
        print(f"Wrote {len(subset)} inert snapshots to {output} ({sum(case['label'] == 'scam' for case in subset)} scam, {sum(case['label'] == 'benign' for case in subset)} benign)")
    if not manifest_path.exists():
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
