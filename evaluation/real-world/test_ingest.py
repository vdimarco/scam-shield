import hashlib
import json
import stat
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ingest import has_content, selected_files, snapshot_from_html, write_snapshots


class SnapshotTest(unittest.TestCase):
    def test_static_extraction_keeps_original_url_and_ignores_scripts(self):
        html = '''<title>Parcel update</title><body><script>doNotRun()</script>
        <p>Pay a fee to release your parcel.</p><form action="https://other.example/pay">
        <input type="text" name="card-number"><input type="password"></form>
        <a href="https://other.example/">parcel.example</a>
        <a href="https://help.parcel.example/">parcel.example</a>
        <a>fake.example</a>
        <div hidden>Invisible bait</div><p>Visible conclusion.</p></body>'''
        result = snapshot_from_html("https://parcel.example/update", html)
        self.assertEqual(result["url"], "https://parcel.example/update")
        self.assertEqual(result["title"], "Parcel update")
        self.assertNotIn("doNotRun", result["text"])
        self.assertIn("Pay a fee", result["text"])
        self.assertIn("Visible conclusion", result["text"])
        self.assertNotIn("Invisible bait", result["text"])
        self.assertTrue(result["asksForCard"])
        self.assertTrue(result["asksForPassword"])
        self.assertEqual(result["formsPostElsewhere"], 1)
        self.assertEqual(result["mismatchedLinks"], 1)

    def test_holdout_hash_ranks_exclude_pilot(self):
        category = "online_shopping_english"
        files = [{"name": f"site{i}.example.html.gz", "size": 100, "sha": f"{i:040x}"} for i in range(31)]
        urls = "\n".join(f"https://site{i}.example/" for i in range(31))

        def fake_fetch(url):
            return json.dumps(files).encode() if "api.github.com" in url else urls.encode()

        with patch("ingest.fetch", side_effect=fake_fetch):
            _, pilot, _ = selected_files("scam", category)
            _, candidates, _ = selected_files("scam", category, 5, None)
        expected = sorted(files, key=lambda item: hashlib.sha256(f"scam/{category}/{item['sha']}".encode()).hexdigest())
        self.assertEqual([item[0]["sha"] for item in pilot], [item["sha"] for item in expected[:5]])
        self.assertEqual([item[0]["sha"] for item in candidates], [item["sha"] for item in expected[5:]])
        self.assertFalse({item[1] for item in pilot} & {item[1] for item in candidates})

    def test_snapshots_use_private_directory_and_file_modes(self):
        with tempfile.TemporaryDirectory() as temporary:
            private = Path(temporary) / "snapshots"
            with patch("ingest.PRIVATE", private):
                write_snapshots("holdout-200.json", [{"label": "scam", "page": {"url": "https://example.test/"}}])
            self.assertEqual(stat.S_IMODE(private.stat().st_mode), 0o700)
            output = private / "holdout-200.json"
            self.assertEqual(stat.S_IMODE(output.stat().st_mode), 0o600)
            self.assertEqual(len(json.loads(output.read_text())["cases"]), 1)

    def test_empty_capture_exclusion(self):
        self.assertFalse(has_content({"title": "  ", "text": "\n"}))
        self.assertTrue(has_content({"title": "Notice", "text": ""}))
        self.assertTrue(has_content({"title": "", "text": "Payment details"}))


if __name__ == "__main__":
    unittest.main()
