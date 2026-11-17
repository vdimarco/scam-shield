import unittest

from ingest import snapshot_from_html


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


if __name__ == "__main__":
    unittest.main()
