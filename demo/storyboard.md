# Scam Shield judge video

The [80-second judge cut](scam-shield-judge-final.mp4) has ElevenLabs Faye
[voiceover](voiceover-script.md), [English subtitles](scam-shield-judge-final.srt),
restrained motion graphics, and real Chrome footage of an automatic in-page warning
beside the extension's native side panel. The older-woman portrait is an original,
[illustrative generated image](media-provenance.md). The parcel page is a synthetic,
inert local fixture. The hosted checker screenshot and extension capture are two
separate observed on-device runs.

**Public status:** The final narrated film is live on [YouTube](https://youtu.be/6C-LlPtNjP0)
and the [Vercel demo](https://scam-shield-landing-phi.vercel.app/#demo-video), where WebVTT captions are available.

## Footage and claims

| Time | What the film shows | Evidence and limit |
| --- | --- | --- |
| 0:00–0:29 | An illustrative grandmother scenario, a fictional parcel page, and the hosted checker result. | The [hosted screenshot](hosted-on-device-proof.png) reports on-device inference in Chrome. This was a separate run from the extension capture. |
| 0:29–0:37 | The installed extension flags the synthetic parcel page, shows an automatic in-page warning, and reports that the check ran on this computer. | The [8.5-second clip](automatic-warning-and-panel-on-device.webm) uses simultaneous recordings of two genuine Chrome targets: the local fixture page and native 360px side panel. They are arranged side by side for legibility, so this is an edited composition rather than an uninterrupted whole-window recording. The [observation](automatic-warning-and-panel-on-device.json) records Chrome 157, a suspicious verdict, visible warning, and exact on-device source label. The film labels this a synthetic local test. |
| 0:37–1:20 | The fresh 80-page archived evaluation, protective steps, and links to the live checker and source. | The final local-only run gave 30 warnings, 9 unsure results, no safe verdicts, and 1 timeout among 40 scam pages. Among 40 legitimate pages it gave 1 false alarm, 21 unsure results, and 18 safe verdicts. All 79 completed checks reported on-device inference. The [method and full results](../evaluation/real-world/README.md) describe the static extraction and limits; this is not a live-browsing accuracy estimate. |

The extension footage was assembled from synchronized CDP screenshots of the real page
and side panel. The page uses fictional `.invalid` destinations; no live scam site was
opened, no payment can be made, and no product state was simulated. The first portrait
is a fictional illustration, not a photograph of the creator's grandmother.

A [separate earlier panel-only recording](extension-check-on-device.webm) includes a
later optional cloud second-opinion attempt that failed App Check validation in its
isolated test profile. The final film uses the new automatic-warning capture and makes
no cloud second-opinion result claim.

`scam-shield-narrated.mp4`, `scam-shield-judge-candidate.mp4`, and
`scam-shield-real-check.mp4` are historical cuts, not the current judge video.

To reproduce the product check, build the private judge extension and use a model-ready
Chrome profile on a real desktop. Launch Chrome with remote debugging and
`--enable-unsafe-extension-debugging`, then set `CAPTURE_CDP_URL` and run
`node demo/capture_warning_composite.mjs`. The capture verifies
that the local fixture produced a visible suspicious warning and on-device source
label. The film is rebuilt with `python3 demo/build_narrated_video.py`; its scorecard
is checked against the recorded fresh 80-page result. No App Check debug token,
personal message, or real browsing URL is included in this folder.
