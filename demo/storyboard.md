# Scam Shield judge video

The [88-second final cut](scam-shield-judge-final.mp4) has the existing ElevenLabs Faye
[voiceover](voiceover-script.md), [English subtitles](scam-shield-judge-final.srt), restrained
motion highlights, and a real recording of the installed extension UI. The fictional parcel
page and older-adult portrait are labelled illustrations. The hosted on-device result is an
observed [screenshot](hosted-on-device-proof.png), not video of the extension running locally.

**Public status:** [the current YouTube upload](https://youtu.be/49NiHLv1WZg) is the earlier
silent, captioned 88-second cut. The new narrated final cut is a local file and has not been
uploaded to YouTube.

## Footage and claims

| Time | What the video shows | Evidence and limit |
| --- | --- | --- |
| 0:00–0:32 | An illustrative grandmother scenario, a fictional parcel page, and the hosted checker result. | The hosted result screenshot reports on-device inference in Chrome. It does not establish that the extension's automatic path ran on-device. |
| 0:32–0:58 | The actual installed extension checks the local parcel fixture and gives a requested second opinion. | The right side is a [13-second recording](extension-check-live.webm) of `sidepanel.html` opened in an **extension tab** while the fixture tab stayed active. The page on the left is a still from that synthetic fixture. This is an edited split view, not a continuous native side-panel-plus-page screen recording. The [observation](extension-check-live.json) records a cloud-labelled first check, a cloud second opinion, zero source links, and the visible web-verification limit. |
| 0:58–1:28 | A small synthetic scorecard, concrete protective steps, and the public checker and source links. | The 4/4 and 0/4 figures are from one eight-page synthetic run. The separate [archived-page evaluation](../evaluation/real-world/README.md) gives a broader bounded test; neither is a live-browsing accuracy estimate. |

No real scam site was opened for this video. The parcel page cannot take payment and uses
fictional `.invalid` destinations. The portrait is illustrative and is not a photograph of the
creator's grandmother. The requested cloud check is labelled as cloud in the footage. Web
search grounding did not return sources; the film does not claim independent verification.

To reproduce the recording, build the private judge extension, copy an authorized Chromium
test profile outside the repository, then set `CAPTURE_PROFILE` to that throwaway copy and run
`xvfb-run -a node demo/capture_extension.mjs`. The script resets only that copy's check count.
The narrated cut is built with `python3 demo/build_narrated_video.py`. No App Check debug token,
personal message, or real browsing URL is included in the video or this folder.
