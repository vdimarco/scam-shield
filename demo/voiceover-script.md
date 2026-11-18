# Scam Shield judge demo voiceover

Voice: Faye preset, generated with the ElevenLabs engine through Higgsfield Text to Speech V2.
The final 48 kHz AAC stem is `scam-shield-judge-voiceover-48k.m4a`. It uses complete sentences
from the previously generated clips; the old private-model-unavailable sentence is excluded.

| Scene | Starts | Narration |
| --- | ---: | --- |
| 1 · Grandmother | 0.8s | I built Scam Shield thinking about my grandmother. A rushed parcel notice could catch her off guard. |
| 2 · Fictional parcel page | 8.8s | This fictional page demands a tiny fee, card details, and a decision in thirty minutes. The pressure is the clue. |
| 3 · Hosted checker result | 19.5s | In the live checker, Firebase AI Logic flagged that pressure. Chrome ran the check on this device; the text stayed in the browser. |
| 4 · Native extension panel | 32.1s | The extension warns beside the page. She stays in control. |
| 5 · Archived-page scorecard | 37.8s | On eighty fresh archived pages, Scam Shield warned on thirty of forty scams. Nine were unsure, one timed out, and none were called safe. Of forty legitimate pages, one was falsely flagged. These results do not measure live browsing. |
| 6 · Protective action | 60.3s | Close the page. Open the official delivery app. Or call a number she already trusts. |
| 7 · Next step | 71.0s | Try the live checker and inspect the source. Give someone we love a calm moment before the next click. |

The scorecard uses a new ElevenLabs Faye clip, `voiceover-80-archived.mp3`, which matches the
fresh final-build evaluation in `evaluation/real-world/results-fresh-80-final.json`. The old
`voiceover-06.mp3` synthetic-scorecard clip is excluded. The `voiceover-04.mp3` source clip
contains an older second sentence; only its first 2.2 seconds are used in the final stem.
The `voiceover-07.mp3` sentences are split between scenes 4 and 6.
The portrait and parcel page shown in the film are illustrative. The on-device extension
source text is recorded in `extension-check-on-device.json` and visible in the final video.
